# Confirmation email

Prepared branding for the existing email-confirmation-link flow (not a numeric OTP). Use confirm-signup-subject.txt as the subject and confirm-signup.html as the Confirm sign up template body. Preserve all `{{ .ConfirmationURL }}` placeholders exactly; Supabase fills them with the one-time verification URL. No credentials or live confirmation tokens belong in this repository.

Activation is pending: the current project's Supabase dashboard disables subject/source edits without custom SMTP. It offers custom SMTP or upgrading to Pro to customize templates using Supabase's sending service. Configure the chosen sender/provider in Authentication → Emails → SMTP Settings, or upgrade separately, then paste and save the subject/body under Authentication → Emails → Confirm sign up. Do not change the app's email/password flow.

The template uses inline styles, presentation tables, system fonts, a hosted PNG logo with explicit dimensions, a confirmation button, a plain-link fallback and mobile-friendly fluid width. Images may be blocked by email clients; the text brand and link remain usable. Local Chrome preview checks do not substitute for delivery tests in Gmail, Outlook and Apple Mail after sender setup. No emails have been sent by this branding task.
