import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function base64ToBytes(b64: string): Uint8Array {
  try {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i);
    }
    return bytes;
  } catch (_e) {
    throw new Error('INVALID_BASE64');
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function getEncryptionKey(version?: number): string | null {
  const v = version ?? 1;
  const keyVar = `ENCRYPTION_KEY_V${v}`;
  const fallbackVar = 'ENCRYPTION_KEY';
  const key = Deno.env.get(keyVar) || Deno.env.get(fallbackVar) || null;
  return key;
}

async function importAesKey(rawKeyString: string): Promise<CryptoKey> {
  let keyBytes: Uint8Array;

  // Try base64 decoding first (most common format for encryption keys)
  try {
    const decoded = base64ToBytes(rawKeyString);
    if (decoded.byteLength === 32) {
      keyBytes = decoded;
    } else {
      throw new Error('Base64 decoded key is not 32 bytes');
    }
  } catch (_e) {
    // If base64 fails, try UTF-8 encoding
    const enc = new TextEncoder();
    keyBytes = enc.encode(rawKeyString);
    
    if (keyBytes.byteLength !== 32) {
      console.error('Key length:', keyBytes.byteLength, 'bytes (need 32)');
      throw new Error('INVALID_KEY_LENGTH: Key must be exactly 32 bytes');
    }
  }

  return await crypto.subtle.importKey(
    'raw',
    keyBytes as BufferSource,
    'AES-GCM',
    false,
    ['encrypt']
  );
}

function getOrGenerateIv() {
  const ivBytes = crypto.getRandomValues(new Uint8Array(12));
  const ivB64 = bytesToBase64(ivBytes);
  return { ivBytes, ivB64 };
}

async function encryptGCM(plaintext: string, keyString: string, version: number) {
  if (!keyString) throw new Error('MISSING_KEY');

  const cryptoKey = await importAesKey(keyString);
  const { ivBytes, ivB64 } = getOrGenerateIv();

  try {
    const encoded = new TextEncoder().encode(plaintext);
    
    // Encrypt with AES-GCM
    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: ivBytes,
        tagLength: 128
      },
      cryptoKey,
      encoded
    );

    // AES-GCM returns ciphertext + auth tag (last 16 bytes)
    const full = new Uint8Array(encrypted);
    
    if (full.byteLength < 16) {
      console.error('Encryption output too short:', full.byteLength);
      throw new Error('ENCRYPTION_FAILED: Output too short');
    }

    // Extract auth tag (last 16 bytes) and ciphertext (everything else)
    const tagBytes = full.slice(full.byteLength - 16);
    const cipherBytes = full.slice(0, full.byteLength - 16);

    return {
      ciphertext: bytesToBase64(cipherBytes),
      iv: ivB64,
      authTag: bytesToBase64(tagBytes),
      version
    };
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('ENCRYPTION_FAILED: ' + (error as Error).message);
  }
}

async function getUserFromRequest(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return null;
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error) {
    console.error('Auth error:', error);
    return null;
  }

  return user;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Encrypt Banking Details Request ===');

    const user = await getUserFromRequest(req);
    if (!user) {
      console.error('Authentication failed - no user found');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Unauthorized - please login first'
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Authenticated user:', user.id);

    let body: any = {};
    try {
      body = await req.json();
    } catch (_e) {
      // No body provided is fine; we'll fall back to DB values
    }

    const { account_number, bank_code, bank_name, business_name, email } = body;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: row, error: rowError } = await supabase
      .from('banking_subaccounts')
      .select(
        'id, encrypted_account_number, encrypted_bank_code, encrypted_bank_name, encrypted_business_name, encrypted_email, account_number, bank_code, bank_name, business_name, email'
      )
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (rowError || !row) {
      console.error('No banking record found:', rowError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No banking record found for user'
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const source = {
      account_number: account_number ?? row.account_number ?? null,
      bank_code: bank_code ?? row.bank_code ?? null,
      bank_name: bank_name ?? row.bank_name ?? null,
      business_name: business_name ?? row.business_name ?? null,
      email: email ?? row.email ?? null
    };

    const encryptionKey = getEncryptionKey();
    if (!encryptionKey) {
      console.error('Encryption key not configured');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Encryption key not configured'
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    try {
      const updates: any = {};
      const responseData: any = {};
      const updatedFields: string[] = [];

      if (!row.encrypted_account_number && source.account_number) {
        console.log('Encrypting account_number...');
        const encrypted = await encryptGCM(source.account_number, encryptionKey, 1);
        updates.encrypted_account_number = JSON.stringify(encrypted);
        responseData.encrypted_account_number = encrypted;
        updatedFields.push('account_number');
      }

      if (!row.encrypted_bank_code && source.bank_code) {
        console.log('Encrypting bank_code...');
        const encrypted = await encryptGCM(source.bank_code, encryptionKey, 1);
        updates.encrypted_bank_code = JSON.stringify(encrypted);
        responseData.encrypted_bank_code = encrypted;
        updatedFields.push('bank_code');
      }

      if (!row.encrypted_bank_name && source.bank_name) {
        console.log('Encrypting bank_name...');
        const encrypted = await encryptGCM(source.bank_name, encryptionKey, 1);
        updates.encrypted_bank_name = JSON.stringify(encrypted);
        responseData.encrypted_bank_name = encrypted;
        updatedFields.push('bank_name');
      }

      if (!row.encrypted_business_name && source.business_name) {
        console.log('Encrypting business_name...');
        const encrypted = await encryptGCM(source.business_name, encryptionKey, 1);
        updates.encrypted_business_name = JSON.stringify(encrypted);
        responseData.encrypted_business_name = encrypted;
        updatedFields.push('business_name');
      }

      if (!row.encrypted_email && source.email) {
        console.log('Encrypting email...');
        const encrypted = await encryptGCM(source.email, encryptionKey, 1);
        updates.encrypted_email = JSON.stringify(encrypted);
        responseData.encrypted_email = encrypted;
        updatedFields.push('email');
      }

      if (updatedFields.length === 0) {
        console.log('No fields to encrypt for user:', user.id);
        return new Response(
          JSON.stringify({
            success: true,
            updatedFields: [],
            message: 'Nothing to encrypt'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      const { error: updateError } = await supabase
        .from('banking_subaccounts')
        .update(updates)
        .eq('id', row.id);

      if (updateError) {
        console.error('Failed updating encrypted fields:', updateError);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Failed to save encrypted data: ' + updateError.message
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      console.log('✅ Successfully encrypted fields for user', user.id, ':', updatedFields);

      return new Response(
        JSON.stringify({
          success: true,
          updatedFields,
          data: responseData
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    } catch (encryptError) {
      console.error('Failed to encrypt banking details:', encryptError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to encrypt banking details: ' + (encryptError as Error).message
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
  } catch (error) {
    console.error('Unexpected error in encrypt-banking-details:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error: ' + (error as Error).message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
