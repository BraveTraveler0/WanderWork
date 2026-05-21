import { motion } from "motion/react";
import { ArrowRight, Zap, Users, Briefcase, CheckCircle } from "lucide-react";

export default function LandingPage() {
  const handleSignUp = () => {
    window.open("https://tally.so/r/wLraG2", "_blank");
  };

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Navigation */}
      <nav className="fixed w-full top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-[#306770]">Wanderwork</h1>
          <button
            onClick={handleSignUp}
            className="px-6 py-2 bg-[#306770] text-white rounded-lg hover:bg-[#1f4a52] transition-colors"
          >
            Sign Up
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <h2 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
              Find Your Perfect Job With <span className="text-[#306770]">AI</span>
            </h2>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              Wanderwork uses advanced AI to match you with job opportunities that align with your skills, experience, and career goals.
            </p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleSignUp}
              className="inline-flex items-center gap-2 px-8 py-4 bg-[#306770] text-white text-lg font-semibold rounded-xl hover:bg-[#1f4a52] transition-colors shadow-lg"
            >
              Get Started Free <ArrowRight size={20} />
            </motion.button>
          </motion.div>

          {/* Features Grid */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="grid md:grid-cols-3 gap-8 mt-20"
          >
            {[
              {
                icon: Zap,
                title: "AI-Powered Matching",
                description:
                  "Our advanced AI analyzes job descriptions and your profile to find the best matches.",
              },
              {
                icon: Users,
                title: "Smart Filtering",
                description:
                  "Filter by location, industry, salary, and more to find exactly what you're looking for.",
              },
              {
                icon: Briefcase,
                title: "Resume Ready",
                description:
                  "Get AI-generated resume tips and cover letters tailored to each job application.",
              },
            ].map((feature, index) => (
              <motion.div
                key={index}
                whileHover={{ y: -8 }}
                className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100"
              >
                <feature.icon className="w-12 h-12 text-[#306770] mb-4" />
                <h3 className="text-xl font-bold text-gray-900 mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-600">{feature.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <motion.h2
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="text-4xl font-bold text-center text-gray-900 mb-16"
          >
            How It Works
          </motion.h2>

          <div className="grid md:grid-cols-4 gap-6">
            {[
              { step: 1, title: "Sign Up", description: "Create your profile and upload your resume" },
              { step: 2, title: "AI Analysis", description: "Our AI analyzes your skills and experience" },
              { step: 3, title: "Get Matches", description: "Receive personalized job recommendations" },
              { step: 4, title: "Apply & Win", description: "Apply with AI-enhanced materials" },
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="relative"
              >
                <div className="bg-white p-6 rounded-xl shadow-md">
                  <div className="w-12 h-12 bg-[#306770] text-white rounded-full flex items-center justify-center font-bold mb-4">
                    {item.step}
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">
                    {item.title}
                  </h3>
                  <p className="text-gray-600">{item.description}</p>
                </div>
                {index < 3 && (
                  <div className="hidden md:block absolute top-12 -right-3 w-6 h-1 bg-[#306770]" />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.h2
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="text-4xl font-bold text-center text-gray-900 mb-16"
          >
            Why Choose Wanderwork?
          </motion.h2>

          <div className="space-y-4">
            {[
              "Save hours of job searching - let AI do it for you",
              "Only see jobs that match your skills and goals",
              "Get professional resume and cover letter suggestions",
              "Track all your applications in one place",
              "Receive notifications for new matching opportunities",
              "Free to use - premium features available",
            ].map((benefit, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
                className="flex items-center gap-4 p-4 bg-white rounded-lg shadow-sm border border-gray-100"
              >
                <CheckCircle className="w-6 h-6 text-[#306770] flex-shrink-0" />
                <span className="text-gray-800 font-medium">{benefit}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-[#306770] to-[#1f4a52]">
        <div className="max-w-4xl mx-auto text-center">
          <motion.h2
            initial={{ opacity: 0, y: -20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-4xl font-bold text-white mb-6"
          >
            Ready to Find Your Next Opportunity?
          </motion.h2>
          <p className="text-xl text-blue-100 mb-8">
            Join thousands of job seekers using Wanderwork to advance their careers.
          </p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleSignUp}
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-[#306770] text-lg font-semibold rounded-xl hover:bg-blue-50 transition-colors shadow-lg"
          >
            Sign Up Now <ArrowRight size={20} />
          </motion.button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <p>&copy; 2026 Wanderwork. All rights reserved.</p>
          <p className="text-sm mt-2">
            Helping job seekers find their perfect match with AI technology.
          </p>
        </div>
      </footer>
    </div>
  );
}
