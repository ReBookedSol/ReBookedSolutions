import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { emailService } from "@/services/emailService";

const EmailTest: React.FC = () => {
  const [type, setType] = useState("delivered_prompt");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [sellerEmail, setSellerEmail] = useState("");
  const [orderId, setOrderId] = useState("");
  const [bookTitle, setBookTitle] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [sellerName, setSellerName] = useState("");
  const [issueDetails, setIssueDetails] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const sendTest = async () => {
    setStatus(null);
    try {
      if (type === "delivered_prompt") {
        if (!buyerEmail || !orderId) throw new Error("Provide buyer email and order id");
        const html = `<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>Your Book Has Arrived</title></head><body style=\"font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;\"><div style=\"background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:25px;text-align:center;border-radius:8px;color:#fff;\"><h1 style=\"margin:0;font-size:22px;\">Your Book Has Arrived!</h1></div><div style=\"background:#f9f9f9;padding:20px;border-radius:0 0 8px 8px;border:1px solid #ddd;\"><p>Hello ${buyerName || 'Buyer'},</p><p>Your order has been marked as delivered. Please log into your account and confirm whether you received the order to complete the transaction.</p><p style=\"text-align:center;margin-top:18px;\"><a href=\"https://rebookedsolutions.co.za/orders/${orderId}\" style=\"padding:12px 18px;background:#667eea;color:#fff;border-radius:6px;text-decoration:none;\">Confirm Delivery</a></p></div></body></html>`;
        const text = `Your Book Has Arrived!\n\nHello ${buyerName || 'Buyer'},\n\nYour order has been marked as delivered. Confirm: https://rebookedsolutions.co.za/orders/${orderId}`;
        await emailService.sendEmail({ to: buyerEmail, subject: "Your Book Has Arrived — Please Confirm", html, text });
      }

      if (type === "received_yes") {
        if (!buyerEmail || !sellerEmail) throw new Error("Provide buyer and seller emails");
        // buyer
        const buyerHtml = `<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>Thank you — Order Received</title></head><body style=\"font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;\"><div style=\"background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:25px;text-align:center;border-radius:8px;color:#fff;\"><h1 style=\"margin:0;font-size:22px;\">Thank you — Order Received</h1></div><div style=\"background:#f9f9f9;padding:20px;border-radius:0 0 8px 8px;border:1px solid #ddd;\"><p>Hello ${buyerName || 'Buyer'},</p><p>Thanks for confirming receipt of <strong>${bookTitle}</strong>. We will release payment to the seller shortly.</p></div></body></html>`;
        const buyerText = `Thank you — Order Received\n\nThanks for confirming receipt of ${bookTitle}. We will release payment to the seller shortly.`;
        await emailService.sendEmail({ to: buyerEmail, subject: "Thank you — Order Received", html: buyerHtml, text: buyerText });

        // seller
        const sellerHtml = `<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>Payment on the way</title></head><body style=\"font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;\"><div style=\"background:linear-gradient(135deg,#00b894 0%,#00a085 100%);padding:25px;text-align:center;border-radius:8px;color:#fff;\"><h1 style=\"margin:0;font-size:22px;\">Payment on the way</h1></div><div style=\"background:#f9f9f9;padding:20px;border-radius:0 0 8px 8px;border:1px solid #ddd;\"><p>Hello ${sellerName || 'Seller'},</p><p>The buyer has confirmed delivery of <strong>${bookTitle}</strong>. We will process your payment and notify you once it has been released.</p></div></body></html>`;
        const sellerText = `Payment on the way\n\nThe buyer has confirmed delivery of ${bookTitle}. We will process your payment and notify you once it has been released.`;
        await emailService.sendEmail({ to: sellerEmail, subject: "Payment on the way — ReBooked Solutions", html: sellerHtml, text: sellerText });
      }

      if (type === "received_no") {
        if (!buyerEmail || !sellerEmail) throw new Error("Provide buyer and seller emails");
        const buyerHtml = `<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>We've received your report</title></head><body style=\"font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;\"><div style=\"background:linear-gradient(135deg,#ff6b6b 0%,#ee5a24 100%);padding:25px;text-align:center;border-radius:8px;color:#fff;\"><h1 style=\"margin:0;font-size:22px;\">We've received your report</h1></div><div style=\"background:#f9f9f9;padding:20px;border-radius:0 0 8px 8px;border:1px solid #ddd;\"><p>Hello ${buyerName || 'Buyer'},</p><p>Thank you for reporting an issue. Our support team will contact you shortly to investigate: "${issueDetails}"</p></div></body></html>`;
        const buyerText = `We've received your report\n\nThank you for reporting an issue. Our support team will contact you shortly to investigate: "${issueDetails}"`;
        await emailService.sendEmail({ to: buyerEmail, subject: "We've received your report — ReBooked Solutions", html: buyerHtml, text: buyerText });

        const sellerHtml = `<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>Issue finalising order</title></head><body style=\"font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;\"><div style=\"background:linear-gradient(135deg,#fdcb6e 0%,#e17055 100%);padding:25px;text-align:center;border-radius:8px;color:#fff;\"><h1 style=\"margin:0;font-size:22px;\">Issue finalising order</h1></div><div style=\"background:#f9f9f9;padding:20px;border-radius:0 0 8px 8px;border:1px solid #ddd;\"><p>Hello ${sellerName || 'Seller'},</p><p>We encountered an issue while finalising Order ID: ${orderId}. The buyer reported: "${issueDetails}". Our team is investigating and may contact you for more information.</p></div></body></html>`;
        const sellerText = `Issue finalising order\n\nWe encountered an issue while finalising Order ID: ${orderId}. The buyer reported: "${issueDetails}".`;
        await emailService.sendEmail({ to: sellerEmail, subject: "Issue finalising order — ReBooked Solutions", html: sellerHtml, text: sellerText });
      }

      setStatus("Emails sent successfully");
    } catch (err: any) {
      setStatus(`Failed: ${err?.message || String(err)}`);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-xl font-semibold mb-4">Email Test</h2>
      <div className="space-y-3">
        <Label>Type</Label>
        <Select value={type} onValueChange={(v) => setType(v)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="delivered_prompt">Delivered prompt (notify buyer to confirm)</SelectItem>
            <SelectItem value="received_yes">Buyer received (notify buyer + seller payment)</SelectItem>
            <SelectItem value="received_no">Buyer not received (notify buyer + seller issue)</SelectItem>
          </SelectContent>
        </Select>

        <div>
          <Label>Order ID</Label>
          <Input value={orderId} onChange={(e) => setOrderId(e.target.value)} />
        </div>

        <div>
          <Label>Buyer Email</Label>
          <Input value={buyerEmail} onChange={(e) => setBuyerEmail(e.target.value)} />
        </div>

        <div>
          <Label>Seller Email</Label>
          <Input value={sellerEmail} onChange={(e) => setSellerEmail(e.target.value)} />
        </div>

        <div>
          <Label>Book Title</Label>
          <Input value={bookTitle} onChange={(e) => setBookTitle(e.target.value)} />
        </div>

        <div>
          <Label>Buyer Name</Label>
          <Input value={buyerName} onChange={(e) => setBuyerName(e.target.value)} />
        </div>

        <div>
          <Label>Seller Name</Label>
          <Input value={sellerName} onChange={(e) => setSellerName(e.target.value)} />
        </div>

        {type === "received_no" && (
          <div>
            <Label>Issue Details</Label>
            <Input value={issueDetails} onChange={(e) => setIssueDetails(e.target.value)} />
          </div>
        )}

        <div className="pt-3">
          <Button onClick={sendTest}>Send Test Emails</Button>
        </div>

        {status && <div className="mt-3 text-sm">{status}</div>}
      </div>
    </div>
  );
};

export default EmailTest;
