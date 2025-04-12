import React from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Sparkles, Building, GraduationCap, Users, Clock, Shield, Globe } from 'lucide-react';

const About = () => {
  const features = [
    {
      icon: MessageSquare,
      title: "24/7 Circuit Assistance",
      description: "Get instant answers about any circuit design, troubleshooting, and electronic component selection."
    },
    {
      icon: Building,
      title: "Multiple Circuit Types",
      description: "Access information about digital, analog, power electronics, and microcontroller-based circuits."
    },
    {
      icon: GraduationCap,
      title: "Engineering Guidance",
      description: "Get guidance about various electronic designs, optimization techniques, and professional solutions."
    },
    {
      icon: Globe,
      title: "Component Database",
      description: "Learn about our extensive database of electronic components with specifications and applications."
    },
    {
      icon: Shield,
      title: "Reliable Information",
      description: "Access verified and industry-standard circuit designs and troubleshooting methodologies."
    },
    {
      icon: Sparkles,
      title: "AI-Powered",
      description: "Advanced AI technology providing accurate and contextual responses for electronic engineering challenges."
    }
  ];

  const circuitTypes = [
    "Digital Circuits",
    "Analog Circuits",
    "Power Electronics",
    "Microcontrollers",
    "Signal Processing",
    "IoT Solutions"
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.7,
        ease: "easeOut"
      }
    }
  };

  return (
    <div className="min-h-screen bg-black py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Back to Home Button */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <motion.a
            href="/home"
            whileHover={{ scale: 1.05 }}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg font-medium transition-all duration-300 shadow-lg hover:shadow-blue-500/30"
          >
            <MessageSquare className="mr-2 h-5 w-5" />
            Back to Home
          </motion.a>
        </motion.div>

        {/* Hero Section */}
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="text-center mb-20"
        >
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
            Electro <span className="text-blue-500">Circuit AI</span>
          </h1>
          <p className="text-lg md:text-xl text-white/80 max-w-3xl mx-auto leading-relaxed">
            Your comprehensive assistant for electronic circuit design and troubleshooting. 
            Get instant solutions to your electrical engineering challenges through our AI-powered platform.
          </p>
        </motion.div>

        {/* About Electro Circuit AI */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="bg-gray-900 rounded-3xl shadow-xl p-6 md:p-8 lg:p-12 mb-20 hover:shadow-2xl hover:shadow-blue-500/20 transition-all duration-500"
        >
          <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
            <motion.div variants={itemVariants}>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                About <span className="text-blue-500">Electro Circuit AI</span>
              </h2>
              <p className="text-white/80 mb-6 leading-relaxed text-lg">
                Electro Circuit AI is a revolutionary platform established with the vision of 
                making electronic circuit design and troubleshooting accessible to engineers, hobbyists, 
                and students alike. Our AI-driven approach transforms complex circuit analysis into intuitive solutions.
              </p>
              <p className="text-white/80 leading-relaxed text-lg">
                Our platform is known for its excellence in providing real-time analysis, component recommendation, 
                and design optimization, supported by state-of-the-art AI algorithms and experienced engineering databases.
              </p>
            </motion.div>
            <div className="grid grid-cols-2 gap-4">
              {circuitTypes.map((circuitType, index) => (
                <motion.div
                  key={circuitType}
                  variants={itemVariants}
                  whileHover={{ 
                    scale: 1.05, 
                    backgroundColor: "#3B82F6",
                    color: "#000",
                    rotate: 2
                  }}
                  className="bg-gray-800 p-6 rounded-xl shadow-lg transition-all duration-300 cursor-pointer group"
                >
                  <p className="text-sm md:text-base font-medium text-white group-hover:text-black transition-colors duration-300">
                    {circuitType}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8"
        >
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                variants={itemVariants}
                whileHover={{ 
                  scale: 1.03,
                  backgroundColor: "#3B82F6",
                }}
                className="bg-gray-800 p-6 md:p-8 rounded-2xl shadow-lg transition-all duration-500 group hover:shadow-xl hover:shadow-blue-500/20"
              >
                <motion.div 
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.5 }}
                  className="w-16 h-16 bg-gray-900 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-black transition-colors duration-500"
                >
                  <Icon className="h-8 w-8 text-blue-500 group-hover:text-blue-400 transition-colors duration-500" />
                </motion.div>
                <h3 className="text-xl md:text-2xl font-semibold text-white mb-4 group-hover:text-black transition-colors duration-300">
                  {feature.title}
                </h3>
                <p className="text-white/70 leading-relaxed text-base md:text-lg group-hover:text-black/90 transition-colors duration-300">
                  {feature.description}
                </p>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Contact Section */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="mt-20 text-center"
        >
          
          </motion.div>
      </div>
    </div>
  );
};

export default About;