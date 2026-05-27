import { ArrowLeft } from 'lucide-react'

interface TermsOfServicePageProps {
  onBack: () => void
}

const TermsOfServicePage = ({ onBack }: TermsOfServicePageProps) => {
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
            Terms of Service
          </h1>
        </header>

        <div className="bg-white rounded-[15px] p-6 sm:p-8" style={{ boxShadow: '0px 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <div className="prose prose-sm max-w-none text-[14px]" style={{ color: '#787878', fontFamily: 'Manrope' }}>
            <p style={{ color: '#787878', marginBottom: '16px' }}>
              <strong>Last Updated: January 3, 2026</strong>
            </p>

            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#306770', marginTop: '24px', marginBottom: '12px' }}>1. Agreement to Terms</h2>
            <p style={{ marginBottom: '12px' }}>
              By accessing and using Wanderwork, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
            </p>

            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#306770', marginTop: '24px', marginBottom: '12px' }}>2. Use License</h2>
            <p style={{ marginBottom: '12px' }}>
              Permission is granted to temporarily download one copy of the materials (information or software) on Wanderwork for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:
            </p>
            <ul style={{ marginLeft: '20px', marginBottom: '12px' }}>
              <li>Modifying or copying the materials</li>
              <li>Using the materials for any commercial purpose or for any public display</li>
              <li>Attempting to decompile or reverse engineer any software contained on the site</li>
              <li>Transferring the materials to another person or "mirroring" the materials on any other server</li>
              <li>Removing any copyright or other proprietary notations from the materials</li>
              <li>Transmitting (or attempting to transmit) viruses or any other malicious code</li>
            </ul>

            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#306770', marginTop: '24px', marginBottom: '12px' }}>3. Disclaimer</h2>
            <p style={{ marginBottom: '12px' }}>
              The materials on Wanderwork are provided "as is." Wanderwork makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.
            </p>

            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#306770', marginTop: '24px', marginBottom: '12px' }}>4. Limitations</h2>
            <p style={{ marginBottom: '12px' }}>
              In no event shall Wanderwork or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on Wanderwork, even if Wanderwork or an authorized representative has been notified orally or in writing of the possibility of such damage.
            </p>

            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#306770', marginTop: '24px', marginBottom: '12px' }}>5. Accuracy of Materials</h2>
            <p style={{ marginBottom: '12px' }}>
              The materials appearing on Wanderwork could include technical, typographical, or photographic errors. Wanderwork does not warrant that any of the materials on our website are accurate, complete, or current. Wanderwork may make changes to the materials contained on our website at any time without notice.
            </p>

            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#306770', marginTop: '24px', marginBottom: '12px' }}>6. Links</h2>
            <p style={{ marginBottom: '12px' }}>
              Wanderwork has not reviewed all of the sites linked to its website and is not responsible for the contents of any such linked site. The inclusion of any link does not imply endorsement by Wanderwork of the site. Use of any such linked website is at the user's own risk.
            </p>

            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#306770', marginTop: '24px', marginBottom: '12px' }}>7. Modifications</h2>
            <p style={{ marginBottom: '12px' }}>
              Wanderwork may revise these terms of service for its website at any time without notice. By using this website, you are agreeing to be bound by the then current version of these terms of service.
            </p>

            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#306770', marginTop: '24px', marginBottom: '12px' }}>8. Governing Law</h2>
            <p style={{ marginBottom: '12px' }}>
              These terms and conditions are governed by and construed in accordance with the laws of California, and you irrevocably submit to the exclusive jurisdiction of the courts in that location.
            </p>

            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#306770', marginTop: '24px', marginBottom: '12px' }}>9. Contact Information</h2>
            <p style={{ marginBottom: '12px' }}>
              If you have any questions about these Terms of Service, please contact us at:
            </p>
            <p>
              <strong>Email:</strong> support@wanderwork.io<br />
              <strong>Address:</strong> 123 Tech Lane, San Francisco, CA 94105
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TermsOfServicePage
