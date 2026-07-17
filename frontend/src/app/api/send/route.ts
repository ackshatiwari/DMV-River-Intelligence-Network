import { EmailTemplate } from '../../../components/email-template';
import { Resend } from 'resend';

const resend = new Resend(process.env.NEXT_RESEND_API_CREDENTIALS ?? '');
const FALLBACK_EMAIL = 'dmv.rivernetwork@gmail.com';

type ContactPayload = {
  firstName?: string;
  lastName?: string;
  email?: string;
  message?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ContactPayload;
    const firstName = body.firstName?.trim();
    const lastName = body.lastName?.trim();
    const email = body.email?.trim();
    const message = body.message?.trim();

    if (!firstName || !lastName || !email || !message) {
      return Response.json({ error: 'All contact fields are required.' }, { status: 400 });
    }

    const { data, error } = await resend.emails.send({
      from: 'Acme <onboarding@resend.dev>',
      to: [process.env.CONTACT_TO_EMAIL ?? 'dmv.rivernetwork@gmail.com'],
      subject: `New contact message from ${firstName} ${lastName}`,
      text: `You have received a new contact message from ${firstName} ${lastName}. Email: ${email}. Message: ${message}`,
      replyTo: email,
      react: EmailTemplate({ firstName, lastName, email, message }),
    });

    if (error) {
      return Response.json({ error }, { status: 500 });
    }

    return Response.json(data);
  } catch (error) {
    return Response.json({ error }, { status: 500 });
  }
}