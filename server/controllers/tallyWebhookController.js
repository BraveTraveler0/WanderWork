/**
 * Tally Webhook Controller
 * Handles direct form submissions from Tally to MongoDB
 */

const asyncHandler = require('express-async-handler');
const Candidates = require('../models/JobSeeker/jobSeeker.Candidate');

/**
 * Map Tally field labels to MongoDB candidate schema
 */
const FIELD_MAPPING = {
  'First Name': 'firstName',
  'Last Name': 'lastName',
  'Email': 'email',
  'Email Address': 'email',
  'Phone': 'phone',
  'Phone Number': 'phone',
  'Location': 'location',
  'City': 'city',
  'State': 'state',
  'Target Role': 'targetRoles',
  'Desired Role': 'targetRoles',
  'Job Title': 'targetRoles',
  'Seniority': 'seniority',
  'Experience Level': 'seniority',
  'Skills': 'skills',
  'LinkedIn': 'linkedin',
  'LinkedIn URL': 'linkedin',
  'Portfolio': 'portfolio',
  'Portfolio URL': 'portfolio',
  'Website': 'portfolio',
  'Calendly': 'calendly',
  'Calendly URL': 'calendly',
  'Resume Link': 'resumeLink',
  'Resume': 'resumeLink',
  'Resume Text': 'resume_text',
  'Resume Content': 'resume_text',
};

const asArray = (value) => {
  if (Array.isArray(value)) return value.flatMap(asArray).filter(Boolean);
  if (typeof value === 'string') {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return value ? [String(value)] : [];
};

const extractUploadUrl = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return extractUploadUrl(value[0]);
  return value.url || value.link || value.href || value.name || value.filename || '';
};

/**
 * Extract and transform Tally form data to candidate format
 */
const transformTallyData = (tallyPayload) => {
  const fields = tallyPayload.data?.fields || [];
  const raw = {
    status: 'processing',
  };

  // Map Tally fields to candidate schema
  fields.forEach(field => {
    const mappedKey = FIELD_MAPPING[field.label] || field.label.toLowerCase().replace(/\s+/g, '_');
    let value = field.value;

    // Handle special field types
    if (field.type === 'CHECKBOXES' || field.type === 'MULTIPLE_CHOICE') {
      value = Array.isArray(value) ? value : [value];
    }

    if (['skills', 'targetRoles', 'seniority'].includes(mappedKey)) {
      value = asArray(value);
    }

    if (mappedKey === 'resumeLink') {
      value = extractUploadUrl(value);
    }

    // Location: handle as string or create location object
    if (mappedKey === 'location' && typeof value === 'string') {
      raw.location = value;
    } else if (mappedKey === 'city' || mappedKey === 'state') {
      if (!raw.location || typeof raw.location === 'string') raw.location = { locationName: raw.location || '' };
      raw.location[mappedKey] = value;
    } else {
      raw[mappedKey] = value;
    }
  });

  const email = String(raw.email || '').trim().toLowerCase();
  const emailName = email.split('@')[0] || 'Candidate';
  const locationName = typeof raw.location === 'string'
    ? raw.location
    : raw.location?.locationName || [raw.location?.city, raw.location?.state].filter(Boolean).join(', ');

  const urls = [
    raw.linkedin ? { urlName: 'LinkedIn', urlAddress: raw.linkedin } : null,
    raw.portfolio ? { urlName: 'Portfolio', urlAddress: raw.portfolio } : null,
    raw.calendly ? { urlName: 'Calendly', urlAddress: raw.calendly } : null,
  ].filter(Boolean);

  const resumeLink = raw.resumeLink || '';

  return {
    firstName: raw.firstName || emailName,
    lastName: raw.lastName || 'Candidate',
    email,
    phone: raw.phone || 'Not provided',
    location: [{ locationName: locationName || 'New York, NY', city: raw.location?.city || locationName || 'New York', state: raw.location?.state || (locationName ? '' : 'NY') }],
    targetRoles: asArray(raw.targetRoles),
    seniority: asArray(raw.seniority),
    skills: asArray(raw.skills),
    urls,
    resume: resumeLink ? { url: resumeLink, filename: resumeLink.split('/').pop() || 'Resume' } : {},
    resumeLink,
    resume_text: raw.resume_text || '',
    status: 'active',
    paidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    tokenBalance: 30,
    tokensUsed: 0,
    creditsBalance: 30,
    creditsUsed: 0,
    plan: 'free',
    recruiterContactsLeft: 10,
    recruiterContactsUpdatedAt: new Date(),
    tallyResponseId: tallyPayload.data?.responseId,
    tallySubmissionId: tallyPayload.data?.submissionId,
  };
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
      firstName: candidateData.firstName,
      lastName: candidateData.lastName,
      targetRoles: candidateData.targetRoles,
    });

    // Validate required fields
    if (!candidateData.email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    // Check if candidate already exists
    const existingCandidate = await Candidates.findOne({ email: candidateData.email });

    let candidate;
    if (existingCandidate) {
      // Update existing candidate
      console.log('✓ Updating existing candidate:', candidateData.email);
      candidate = await Candidates.findOneAndUpdate(
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
      candidate = await Candidates.create(candidateData);
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
