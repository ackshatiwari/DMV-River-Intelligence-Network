import * as React from 'react';



interface EmailTemplateProps {
  firstName: string;
  lastName: string;
  email: string;
  message: string;
}

export function EmailTemplate({ firstName, lastName, email, message }: EmailTemplateProps) {
  return (
    <div>
      <h1>New contact form submission</h1>
      <p><strong>Name:</strong> {firstName} {lastName}</p>
      <p><strong>Email:</strong> {email}</p>
      <p><strong>Message:</strong></p>
      <p>{message}</p>
    </div>
  );
}