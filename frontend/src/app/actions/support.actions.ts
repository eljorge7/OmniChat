"use server";

export async function sendSupportWebhook(payload: { name: string, phone: string, interest: string }) {
  try {
    const omniChatUrl = process.env.OMNICHAT_INTERNAL_API || 'http://localhost:3002';
    const res = await fetch(`${omniChatUrl}/api/inbox/webhooks/lead`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    
    const data = await res.json();
    if (!res.ok || !data.success) {
       return { success: false, error: data?.message || `Error HTTP: ${res.status}` };
    }
    
    return { success: true };
  } catch (error: any) {
    console.error("Server Action Support Error:", error);
    return { success: false, error: error.message };
  }
}
