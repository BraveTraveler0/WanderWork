/**
 * Tally Webhook Controller
 * Handles direct form submissions from Tally to MongoDB
 */

const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');

// Use dynamic models to avoid strict schema validation
const getCandidateModel = () => {
  return mongoose.models.Candidate || 
         mongoose.model('Candidate', new mongoose.Schema({}, { 
           strict: false, 
           collection: 'jobseeker.candidates' 
         }));
};

/**
 * Map Tally field labels to MongoDB candidate schema
 */
const FIELD_MAPPING = {
  'First Name': 'first_name',
  'Last Name': 'last_name',
  'Email': 'email',
  'Email Address': 'email',
  'Phone': 'phone',
  'Phone Number': 'phone',
  'Location': 'location',
  'City': 'city',
  'State': 'state',
  'Target Role': 'target_role',
  'Desired Role': 'target_role',
  'Job Title': 'target_role',
  'Seniority': 'seniority',
  'Experience Level': 'seniority',
  'Skills': 'skills',
  'LinkedIn': 'linkedin_url',
  'LinkedIn URL': 'linkedin_url',
  'Portfolio': 'portfolio_url',
  'Portfolio URL': 'portfolio_url',
  'Website': 'portfolio_url',
  'Calendly': 'calendly_url',
  'Calendly URL': 'calendly_url',
  'Resume Link': 'resume_link',
  'Resume': 'resume_link',
  'Resume Text': 'resume_text',
  'Resume Content': 'resume_text',
};

/**
 * Extract and transform Tally form data to candidate format
 */
const transformTallyData = (tallyPayload) => {
  const fields = tallyPayload.data?.fields || [];
  const candidateData = {
    source: 'tally',
    status: 'processing',
    tokens_balance: 100,
    tokens_used: 0,
    synced: false,
    createdAt: tallyPayload.data?.createdAt || new Date().toISOString(),
    tallyResponseId: tallyPayload.data?.responseId,
    tallySubmissionId: tallyPayload.data?.submissionId,
  };

  // Map Tally fields to candidate schema
  fields.forEach(field => {
    const mappedKey = FIELD_MAPPING[field.label] || field.label.toLowerCase().replace(/\s+/g, '_');
    let value = field.value;

    // Handle special field types
    if (field.type === 'CHECKBOXES' || field.type === 'MULTIPLE_CHOICE') {
      value = Array.isArray(value) ? value : [value];
    }

    // Skills: split comma-separated values into array
    if (mappedKey === 'skills' && typeof value === 'string') {
      value = value.split(',').map(s => s.trim()).filter(Boolean);
    }

    // Location: handle as string or create location object
    if (mappedKey === 'location' && typeof value === 'string') {
      candidateData.location = value;
    } else if (mappedKey === 'city' || mappedKey === 'state') {
      if (!candidateData.location) candidateData.location = {};
      candidateData.location[mappedKey] = value;
    } else {
      candidateData[mappedKey] = value;
    }
  });

  // Generate candidate_id from email if not present
  if (candidateData.email && !candidateData.candidate_id) {
    candidateData.candidate_id = `tally_${candidateData.email.split('@')[0]}_${Date.now()}`;
  }

  return candidateData;
};

/**
 * POST /api/tally/webhook
 * Handle Tally form submission webhook
 */
const handleTallySubmission = asyncHandler(async (req, res) => {
  try {
    console.log('\n📥 Tally webhook received');
    console.log('Event Type:', req.body.eventType);
    console.log('Form Name:', req.body.data?.formName);

    // Validate webhook payload
    if (req.body.eventType !== 'FORM_RESPONSE') {
      return res.status(400).json({
        success: false,
        message: 'Invalid event type. Expected FORM_RESPONSE.',
      });
    }

    if (!req.body.data?.fields || !Array.isArray(req.body.data.fields)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payload. Missing fields data.',
      });
    }

    // Transform Tally data to candidate format
    const candidateData = transformTallyData(req.body);
    console.log('📝 Transformed candidate data:', {
      email: candidateData.email,
      first_name: candidateData.first_name,
      last_name: candidateData.last_name,
      target_role: candidateData.target_role,
    });

    // Validate required fields
    if (!candidateData.email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    // Get or create candidate model
    const Candidate = getCandidateModel();

    // Check if candidate already exists
    const existingCandidate = await Candidate.findOne({ 
      email: candidateData.email 
    });

    let candidate;
    if (existingCandidate) {
      // Update existing candidate
      console.log('✓ Updating existing candidate:', candidateData.email);
      candidate = await Candidate.findOneAndUpdate(
        { email: candidateData.email },
        { 
          ...candidateData,
          updatedAt: new Date().toISOString(),
        },
        { new: true, runValidators: false }
      );
    } else {
      // Create new candidate
      console.log('✓ Creating new candidate:', candidateData.email);
      candidate = await Candidate.create(candidateData);
    }

    console.log('✅ Candidate saved to MongoDB:', candidate._id);

    // Respond to Tally webhook (must respond within 10 seconds)
    res.status(200).json({
      success: true,
      message: 'Candidate data received and saved',
      candidateId: candidate._id,
      email: candidate.email,
      isNew: !existingCandidate,
    });

  } catch (error) {
    console.error('❌ Error processing Tally webhook:', error);
    
    // Still respond with 200 to prevent Tally from retrying
    // Log the error but don't expose internal details
    res.status(200).json({
      success: false,
      message: 'Webhook received but processing failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

module.exports = {
  handleTallySubmission,
};
