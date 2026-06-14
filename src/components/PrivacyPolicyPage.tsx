import React from 'react'
import { ArrowLeft } from 'lucide-react'

interface PrivacyPolicyPageProps {
  onBack: () => void
}

const H2 = ({ children }: { children: React.ReactNode }) => (
  <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#306770', marginTop: '32px', marginBottom: '10px', fontFamily: 'Manrope' }}>
    {children}
  </h2>
)
const H3 = ({ children }: { children: React.ReactNode }) => (
  <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#444', marginTop: '20px', marginBottom: '8px', fontFamily: 'Manrope' }}>
    {children}
  </h3>
)
const P = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <p style={{ marginBottom: '12px', lineHeight: '1.75', color: '#555', ...style }}>{children}</p>
)
const UL = ({ children }: { children: React.ReactNode }) => (
  <ul style={{ marginLeft: '22px', marginBottom: '14px', lineHeight: '1.75', color: '#555', listStyleType: 'disc' }}>{children}</ul>
)
const LI = ({ children }: { children: React.ReactNode }) => (
  <li style={{ marginBottom: '6px' }}>{children}</li>
)

const PrivacyPolicyPage = ({ onBack }: PrivacyPolicyPageProps) => {
  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(145.48deg, #FFFFFF 1.38%, #F4F4F4 99.61%)' }}>
      <div className="max-w-[860px] mx-auto p-4 sm:p-6">
        <header className="sticky top-0 z-50 flex items-center gap-3 mb-8 py-4 -mt-4" style={{ background: 'linear-gradient(145.48deg, #FFFFFF 1.38%, #F4F4F4 99.61%)' }}>
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft size={24} style={{ color: '#306770' }} />
          </button>
          <h1 className="font-bold text-[24px]" style={{ color: '#306770', fontFamily: 'Manrope' }}>Privacy Policy</h1>
        </header>

        <div className="bg-white rounded-[15px] p-6 sm:p-10" style={{ boxShadow: '0px 4px 20px rgba(0,0,0,0.06)', fontFamily: 'Manrope', fontSize: '14px' }}>

          <P><strong>Effective Date: January 3, 2026 &nbsp;|&nbsp; Last Updated: June 14, 2026</strong></P>

          <P>
            Wander/Work, Inc. ("Wander/Work," "we," "our," or "us") operates the Wander/Work platform — including our website, mobile applications, and AI-assisted job-search tools (collectively, the "Services"). This Privacy Policy describes how we collect, use, store, share, and protect information about you when you use the Services, and explains the choices available to you regarding your information.
          </P>
          <P>
            By accessing or using the Services, you agree to the collection and use of your information as described in this Privacy Policy. If you do not agree, please discontinue use of our Services.
          </P>

          <H2>1. Information We Collect</H2>

          <H3>1.1 Information You Provide Directly</H3>
          <UL>
            <LI><strong>Account Registration:</strong> First name, last name, email address, phone number, password, and profile photo.</LI>
            <LI><strong>Professional Profile:</strong> Work experience, education, skills, target job titles, seniority level, and career goals.</LI>
            <LI><strong>Resume &amp; Documents:</strong> Resume files (PDF, DOCX, RTF), cover letters, and any other documents you upload to the platform.</LI>
            <LI><strong>Profile URLs:</strong> LinkedIn URL, portfolio URL, GitHub URL, Calendly URL, and other professional links.</LI>
            <LI><strong>Payment Information:</strong> Billing name, address, and payment card details (processed by our third-party payment processor; we do not store full card numbers).</LI>
            <LI><strong>Communications:</strong> Messages you send to our support team, survey responses, and feedback you submit.</LI>
          </UL>

          <H3>1.2 Information We Collect Automatically</H3>
          <UL>
            <LI><strong>Usage Data:</strong> Pages visited, features used, search queries, job listings viewed, applications initiated, and clickstream data.</LI>
            <LI><strong>Device &amp; Log Data:</strong> IP address, browser type and version, operating system, referring URLs, and timestamps of access.</LI>
            <LI><strong>Cookies &amp; Similar Technologies:</strong> Session cookies (for authentication), preference cookies (to remember your settings), and analytics cookies (to understand how the Services are used). See Section 7 for more detail.</LI>
            <LI><strong>Performance Data:</strong> Load times, error logs, and crash reports to help us improve stability and speed.</LI>
          </UL>

          <H3>1.3 Information from Third Parties</H3>
          <UL>
            <LI><strong>Job Listing Sources:</strong> We aggregate publicly available job data from job boards, employer career pages, and professional networks to populate job feeds within the Services.</LI>
            <LI><strong>Identity Verification:</strong> If you connect a third-party account (e.g., LinkedIn via OAuth), we may receive basic profile data such as your name, email, and profile picture.</LI>
            <LI><strong>Payment Processors:</strong> When you subscribe, our payment processor (e.g., Stripe) may share transaction status information with us.</LI>
            <LI><strong>Analytics Partners:</strong> Aggregated or pseudonymous data from analytics services that help us understand usage trends.</LI>
          </UL>

          <H2>2. How We Use Your Information</H2>
          <P>We use the information we collect for the following purposes:</P>
          <UL>
            <LI><strong>Service Delivery:</strong> To create and manage your account, match you with relevant job listings, generate AI-tailored resumes and cover letters, and facilitate recruiter outreach.</LI>
            <LI><strong>AI Features:</strong> To power our AI-assisted tools — including resume tailoring, cover letter generation, job matching, and recruiter email drafting — using your profile data and job context. We may send relevant profile data to third-party AI providers (e.g., OpenAI) under strict data processing agreements.</LI>
            <LI><strong>Personalization:</strong> To display job recommendations, filter results, and customize your experience based on your preferences, target roles, and past activity.</LI>
            <LI><strong>Communications:</strong> To send transactional emails (e.g., account confirmation, generated documents), service announcements, and — with your consent — promotional messages and product updates.</LI>
            <LI><strong>Billing &amp; Subscriptions:</strong> To process payments, manage your subscription tier, enforce plan limits (tokens, credits, recruiter contact limits), and prevent fraud.</LI>
            <LI><strong>Analytics &amp; Improvement:</strong> To analyze how the Services are used, identify areas for improvement, conduct A/B testing, and develop new features.</LI>
            <LI><strong>Safety &amp; Compliance:</strong> To detect, investigate, and prevent fraudulent activity, abuse, spam, and violations of our Terms of Service; and to comply with applicable legal obligations.</LI>
            <LI><strong>Legal Basis (where applicable):</strong> Processing may be based on contract performance, legitimate interests, your consent, or legal obligation depending on the applicable jurisdiction.</LI>
          </UL>

          <H2>3. Sharing Your Information</H2>
          <P>We do not sell your personal information. We may share your information in the following circumstances:</P>
          <UL>
            <LI><strong>Service Providers:</strong> We share data with vetted vendors and subprocessors (e.g., cloud hosting, email delivery, payment processing, AI providers) who process data on our behalf under contractual confidentiality and security obligations.</LI>
            <LI><strong>Recruiters (with Your Consent):</strong> If you opt into recruiter outreach, we use your profile data to generate and send personalized emails to recruiters on your behalf. You control which recruiters you contact.</LI>
            <LI><strong>Business Transfers:</strong> In the event of a merger, acquisition, bankruptcy, or sale of all or a portion of our assets, your information may be transferred as part of that transaction. We will notify you via email and/or prominent notice on the Services of any change in ownership or use of your information.</LI>
            <LI><strong>Legal Requirements:</strong> We may disclose your information if required by law, subpoena, court order, or governmental authority, or where we believe disclosure is necessary to protect our rights, protect your safety, or the safety of others.</LI>
            <LI><strong>Aggregate &amp; De-identified Data:</strong> We may share aggregated or de-identified information that cannot reasonably be used to identify you with partners, for research, or for industry reporting.</LI>
            <LI><strong>With Your Consent:</strong> We may share your information for purposes not listed above when you provide explicit consent.</LI>
          </UL>

          <H2>4. AI-Powered Features &amp; Data Processing</H2>
          <P>
            Wander/Work uses large language models (currently OpenAI GPT-4o and related models) to generate resumes, cover letters, and recruiter emails. When you request these features, we transmit relevant portions of your profile (name, contact information, work history, education, skills, and the job description) to OpenAI's API. This data is processed subject to OpenAI's API data usage policies, which prohibit using API data to train OpenAI models by default.
          </P>
          <P>
            We make reasonable efforts to strip placeholder text and ensure accuracy, but you should review all AI-generated content before using it. AI-generated documents are provided as drafts and do not constitute professional career advice.
          </P>

          <H2>5. Data Retention</H2>
          <P>
            We retain your personal information for as long as your account is active or as needed to provide you with the Services. You may request deletion of your account at any time (see Section 9). Upon deletion:
          </P>
          <UL>
            <LI>Active profile data is deleted within 30 days.</LI>
            <LI>Backup copies may persist for up to 90 days before being purged.</LI>
            <LI>We may retain certain records (e.g., billing history, fraud logs) for up to 7 years as required by law.</LI>
            <LI>De-identified, aggregated data derived from your usage may be retained indefinitely for analytics.</LI>
          </UL>
          <P>
            Job listing data that is publicly available and does not contain personal information may be retained for operational purposes including job matching and search indexing. Stale job listings are automatically purged after 60 days.
          </P>

          <H2>6. Security</H2>
          <P>
            We implement industry-standard technical, administrative, and physical safeguards to protect your personal information, including:
          </P>
          <UL>
            <LI>Encryption of data in transit using TLS 1.2 or higher.</LI>
            <LI>Bcrypt hashing of passwords.</LI>
            <LI>JSON Web Token (JWT) authentication with expiration.</LI>
            <LI>Access controls limiting employee access to personal data on a need-to-know basis.</LI>
            <LI>Regular security assessments and vulnerability monitoring.</LI>
          </UL>
          <P>
            No method of electronic transmission or storage is 100% secure. While we strive to protect your personal information, we cannot guarantee absolute security. In the event of a data breach affecting your rights or freedoms, we will notify you and relevant authorities as required by applicable law.
          </P>

          <H2>7. Cookies &amp; Tracking Technologies</H2>
          <P>We use the following types of cookies and similar technologies:</P>
          <UL>
            <LI><strong>Essential Cookies:</strong> Required for authentication and core functionality (e.g., staying logged in). These cannot be disabled.</LI>
            <LI><strong>Preference Cookies:</strong> Store your settings and preferences (e.g., filter configurations, display settings).</LI>
            <LI><strong>Analytics Cookies:</strong> Help us understand how users interact with the Services (e.g., pages visited, time on site). You may opt out of analytics tracking via your browser settings or by contacting us.</LI>
          </UL>
          <P>
            You can control cookies through your browser settings. Disabling certain cookies may affect the functionality of the Services.
          </P>

          <H2>8. International Data Transfers</H2>
          <P>
            Wander/Work is based in the United States. If you access the Services from outside the United States, your information may be transferred to, stored, and processed in the United States or other countries where our service providers operate. Data protection laws in these countries may differ from those in your home country.
          </P>
          <P>
            For users in the European Economic Area (EEA), United Kingdom, or Switzerland, we rely on Standard Contractual Clauses (SCCs) or other lawful transfer mechanisms to ensure adequate protection for international data transfers.
          </P>

          <H2>9. Your Rights &amp; Choices</H2>
          <P>Depending on your location, you may have the following rights regarding your personal information:</P>
          <UL>
            <LI><strong>Access:</strong> Request a copy of the personal information we hold about you.</LI>
            <LI><strong>Correction:</strong> Request correction of inaccurate or incomplete data. You can update most information directly in your account settings.</LI>
            <LI><strong>Deletion:</strong> Request that we delete your personal information, subject to certain legal exceptions.</LI>
            <LI><strong>Portability:</strong> Request that we provide your personal data in a structured, machine-readable format.</LI>
            <LI><strong>Objection / Restriction:</strong> Object to or request restriction of certain processing activities.</LI>
            <LI><strong>Withdraw Consent:</strong> Where processing is based on consent, withdraw your consent at any time without affecting the lawfulness of prior processing.</LI>
            <LI><strong>Opt-Out of Marketing:</strong> Unsubscribe from marketing emails at any time via the unsubscribe link in any email or by contacting us.</LI>
          </UL>
          <P>To exercise any of these rights, contact us at <strong>privacy@wanderwork.io</strong>. We will respond within 30 days (or the period required by applicable law).</P>

          <H2>10. California Privacy Rights (CCPA/CPRA)</H2>
          <P>
            California residents have additional rights under the California Consumer Privacy Act (CCPA) as amended by the California Privacy Rights Act (CPRA):
          </P>
          <UL>
            <LI><strong>Right to Know:</strong> The categories and specific pieces of personal information we collect, use, disclose, or sell.</LI>
            <LI><strong>Right to Delete:</strong> Request deletion of your personal information, subject to exceptions.</LI>
            <LI><strong>Right to Correct:</strong> Request correction of inaccurate personal information.</LI>
            <LI><strong>Right to Opt-Out:</strong> We do not sell or share personal information for cross-context behavioral advertising.</LI>
            <LI><strong>Right to Non-Discrimination:</strong> We will not discriminate against you for exercising your CCPA rights.</LI>
          </UL>
          <P>
            To submit a verifiable consumer request, contact us at <strong>privacy@wanderwork.io</strong> with "California Privacy Request" in the subject line.
          </P>

          <H2>11. Children's Privacy</H2>
          <P>
            The Services are not directed to children under the age of 16. We do not knowingly collect personal information from children under 16. If you become aware that a child has provided us with personal information without parental consent, please contact us immediately at <strong>privacy@wanderwork.io</strong>. We will take steps to remove that information and terminate the child's account.
          </P>

          <H2>12. Third-Party Links &amp; Services</H2>
          <P>
            The Services may contain links to third-party websites, job boards, or employer pages. This Privacy Policy does not apply to those third-party sites, and we are not responsible for their privacy practices. We encourage you to review the privacy policies of any third-party services you visit.
          </P>

          <H2>13. Changes to This Privacy Policy</H2>
          <P>
            We may update this Privacy Policy from time to time. When we make material changes, we will notify you by email (to the address associated with your account) and/or by displaying a prominent notice within the Services at least 30 days before the change takes effect. We will also update the "Last Updated" date at the top of this page. Your continued use of the Services after the effective date constitutes your acceptance of the updated Privacy Policy.
          </P>

          <H2>14. Contact Us</H2>
          <P>If you have any questions, concerns, or requests regarding this Privacy Policy or our privacy practices, please contact us:</P>
          <P>
            <strong>Wander/Work, Inc.</strong><br />
            Attn: Privacy Team<br />
            Email: <strong>privacy@wanderwork.io</strong><br />
            For legal notices: <strong>legal@wanderwork.io</strong>
          </P>
          <P style={{ color: '#9CA3AF', fontSize: '12px', marginTop: '32px', borderTop: '1px solid #E5E7EB', paddingTop: '16px' }}>
            &copy; 2026 Wander/Work, Inc. All rights reserved.
          </P>
        </div>
      </div>
    </div>
  )
}

export default PrivacyPolicyPage
