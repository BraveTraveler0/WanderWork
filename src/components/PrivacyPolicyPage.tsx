import { ArrowLeft } from 'lucide-react'

interface PrivacyPolicyPageProps {
  onBack: () => void
}

const PrivacyPolicyPage = ({ onBack }: PrivacyPolicyPageProps) => {
  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(145.48deg, #FFFFFF 1.38%, #F4F4F4 99.61%)' }}>
      <div className="max-w-[1000px] mx-auto p-4 sm:p-6">
        {/* Header */}
        <header className="sticky top-0 z-50 flex items-center gap-3 mb-8 py-4 -mt-4" style={{ background: 'linear-gradient(145.48deg, #FFFFFF 1.38%, #F4F4F4 99.61%)' }}>
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={24} style={{ color: '#306770' }} />
          </button>
          <h1 className="font-bold text-[24px]" style={{ color: '#306770', fontFamily: 'Manrope' }}>
            Privacy Policy
          </h1>
        </header>

        <div className="bg-white rounded-[15px] p-6 sm:p-8" style={{ boxShadow: '0px 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <div className="prose prose-sm max-w-none text-[14px]" style={{ color: '#787878', fontFamily: 'Manrope' }}>
            <p style={{ color: '#787878', marginBottom: '16px' }}>
              <strong>Last Updated: January 3, 2026</strong>
            </p>

            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#306770', marginTop: '24px', marginBottom: '12px' }}>1. Introduction</h2>
            <p style={{ marginBottom: '12px' }}>
              Wanderwork ("Company," "we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our website and services.
            </p>

            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#306770', marginTop: '24px', marginBottom: '12px' }}>2. Information We Collect</h2>
            <p style={{ marginBottom: '12px' }}>We may collect information about you in a variety of ways:</p>
            <ul style={{ marginLeft: '20px', marginBottom: '12px' }}>
              <li><strong>Personal Information:</strong> Name, email address, phone number, location, and resume details.</li>
              <li><strong>Account Information:</strong> Username, password, and account preferences.</li>
              <li><strong>Payment Information:</strong> Credit card and billing address (processed securely).</li>
              <li><strong>Usage Data:</strong> Information about how you interact with our services.</li>
            </ul>

            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#306770', marginTop: '24px', marginBottom: '12px' }}>3. How We Use Your Information</h2>
            <p style={{ marginBottom: '12px' }}>We use the information we collect to:</p>
            <ul style={{ marginLeft: '20px', marginBottom: '12px' }}>
              <li>Provide, maintain, and improve our services</li>
              <li>Process transactions and send related information</li>
              <li>Send promotional emails and updates (with your consent)</li>
              <li>Respond to your inquiries and customer support requests</li>
              <li>Monitor and analyze usage trends and user preferences</li>
              <li>Detect and prevent fraudulent activities</li>
            </ul>

            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#306770', marginTop: '24px', marginBottom: '12px' }}>4. Information Sharing</h2>
            <p style={{ marginBottom: '12px' }}>
              We do not sell, trade, or rent your personal information to third parties. We may share your information with:
            </p>
            <ul style={{ marginLeft: '20px', marginBottom: '12px' }}>
              <li>Service providers who assist us in operating our website and conducting our business</li>
              <li>Law enforcement when required by law</li>
              <li>Other parties with your consent or at your direction</li>
            </ul>

            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#306770', marginTop: '24px', marginBottom: '12px' }}>5. Data Security</h2>
            <p style={{ marginBottom: '12px' }}>
              We use administrative, technical, and physical security measures to protect your personal information. However, no method of transmission over the Internet is 100% secure.
            </p>

            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#306770', marginTop: '24px', marginBottom: '12px' }}>6. Your Rights</h2>
            <p style={{ marginBottom: '12px' }}>You have the right to:</p>
            <ul style={{ marginLeft: '20px', marginBottom: '12px' }}>
              <li>Access your personal information</li>
              <li>Correct inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Opt-out of marketing communications</li>
            </ul>

            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#306770', marginTop: '24px', marginBottom: '12px' }}>7. Contact Us</h2>
            <p style={{ marginBottom: '12px' }}>
              If you have questions about this Privacy Policy or our privacy practices, please contact us at:
            </p>
            <p style={{ marginBottom: '12px' }}>
              <strong>Email:</strong> privacy@wanderwork.ai<br />
              <strong>Address:</strong> 123 Tech Lane, San Francisco, CA 94105
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PrivacyPolicyPage
