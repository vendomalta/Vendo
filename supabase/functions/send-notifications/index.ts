import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

// Initialize Supabase Client
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const supabase = createClient(supabaseUrl, supabaseServiceKey)

Deno.serve(async (req) => {
  try {
    // 0. Fetch the dynamic template from system_settings
    const { data: templateData, error: templateError } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'email_template_message')
      .single()

    const template = templateData?.value || {
      subject: 'Yeni Mesajınız Var! | Verde',
      content: '<h2>Merhaba {{full_name}},</h2><p>Verde üzerinden yeni bir mesajınız var.</p>'
    }

    // 1. Fetch pending notifications
    const { data: queueItems, error: fetchError } = await supabase
      .from('notification_queue')
      .select(`
        id,
        recipient_id,
        notification_type,
        content,
        profiles:recipient_id (email, full_name)
      `)
      .eq('status', 'pending')
      .limit(10) // Process in small batches

    if (fetchError) throw fetchError

    if (!queueItems || queueItems.length === 0) {
      return new Response(JSON.stringify({ message: 'No pending notifications' }), { status: 200 })
    }

    const results = []

    for (const item of queueItems) {
      const recipientEmail = item.profiles?.email
      const fullName = item.profiles?.full_name || 'Verde Kullanıcısı'
      
      if (!recipientEmail) {
        await supabase.from('notification_queue').update({ status: 'failed', error: 'No email found' }).eq('id', item.id)
        continue
      }

      // Replace placeholders in content
      const customizedContent = template.content.replace('{{full_name}}', fullName)

      // 2. Send email via Resend
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'Verde <notifications@resend.dev>', // Use verified domain late
          to: recipientEmail,
          subject: template.subject,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
              ${customizedContent}
              <a href="https://v4-five.vercel.app/login.html" style="display: inline-block; background: #10b981; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; margin-top: 20px;">Mesajı Gör</a>
              <p style="margin-top: 30px; font-size: 12px; color: #999;">Bu e-posta, bildirim ayarlarınız açık olduğu için gönderilmiştir. Ayarlarınızı istediğiniz zaman profilinizden değiştirebilirsiniz.</p>
            </div>
          `,
        }),
      })

      if (res.ok) {
        await supabase
          .from('notification_queue')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', item.id)
        results.push({ id: item.id, status: 'success' })
      } else {
        const errorData = await res.json()
        await supabase
          .from('notification_queue')
          .update({ status: 'failed', content: { ...item.content, error: errorData } })
          .eq('id', item.id)
        results.push({ id: item.id, status: 'failed', error: errorData })
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), { status: 200 })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})
