        // --- SECTION 1: DOM References and UI State Management (Plumbing) ---
        
        // Setup workers for PDF library
        if (typeof pdfjsLib !== 'undefined') {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
        }
        
        // DOM Element References
        const jobRoleInput = document.getElementById('jobRoleInput'); 
        const resumeInput = document.getElementById('resumeInput');
        const analyzeButton = document.getElementById('analyzeButton');
        const fileInput = document.getElementById('fileInput');
        const statusMessage = document.getElementById('statusMessage');
        const loadingMessage = document.getElementById('loadingMessage');
        const resumeInputContainer = document.getElementById('resumeInputContainer');
        const jobDescriptionContainer = document.getElementById('jobDescriptionContainer');
        const jobDescriptionElement = document.getElementById('jobDescription');
        const circularProgressContainer = document.getElementById('circularProgressContainer');
        const circularProgressOuter = document.getElementById('circularProgressOuter');
        const progressPercentage = document.getElementById('progressPercentage');


        /**
         * Renders the roadmap directly within the list item that was clicked.
         * @param {string} skill The skill name.
         * @param {HTMLElement} liElement The list item that was clicked.
         */
        function renderRoadmap(skill, liElement) {
            // Find the nested roadmap content container within this LI
            const roadmapContentDiv = liElement.querySelector('.inline-roadmap-content');
            const roadmapIcon = liElement.querySelector('.roadmap-toggle-icon');
            
            // Check if it's currently visible
            const isVisible = !roadmapContentDiv.classList.contains('hidden');

            // Hide all other open roadmaps and reset their styles
            document.querySelectorAll('.inline-roadmap-content:not(.hidden)').forEach(div => {
                div.classList.add('hidden');
                const parentLi = div.closest('li');
                parentLi.classList.remove('bg-red-100');
                // Reset icon rotation
                const icon = parentLi.querySelector('.roadmap-toggle-icon');
                if (icon) icon.classList.remove('rotate-90');
            });
            
            if (isVisible) {
                // If the current one was visible, we just hid it via the loop above.
                return; 
            }

            // Generate Roadmap Steps
            const skillUpper = skill.toUpperCase();
            const roadmapSteps = [
                `**Step 1: Foundation (1-2 Weeks):** Start with a beginner-friendly online course or tutorial to learn the core concepts and syntax of **${skillUpper}**.`,
                `**Step 2: Practical Application (2-4 Weeks):** Build a small, simple project (e.g., a mini-dashboard, a component, or a simulated document) to apply your new knowledge.`,
                `**Step 3: Deep Dive & Review:** Explore intermediate topics and best practices. Engage with online communities or find a mentor for advanced learning.`,
                `**Step 4: Portfolio Integration:** Update your resume using the CAR method, describing **what you achieved** using **${skillUpper}** and focusing on quantifiable impact.`
            ];

            // Render Roadmap Content
            let roadmapHtml = `<h5 class="text-lg font-bold text-indigo-800 mb-3 border-b border-indigo-300 pb-1">4-Step Learning Plan:</h5>`;
            roadmapHtml += '<ol class="list-decimal pl-5 space-y-2 text-sm text-gray-700">';
            roadmapSteps.forEach(step => {
                // Replace markdown bold with custom highlight class
                const formattedStep = step.replace(/\*\*(.*?)\*\*/g, '<span class="highlight-text">$1</span>');
                roadmapHtml += `<li>${formattedStep}</li>`;
            });
            roadmapHtml += '</ol>';
            
            roadmapContentDiv.innerHTML = roadmapHtml;

            // Show section and update LI state
            roadmapContentDiv.classList.remove('hidden');
            liElement.classList.add('bg-red-100'); // Highlight the active parent LI
            
            // Rotate the icon
            if (roadmapIcon) roadmapIcon.classList.add('rotate-90'); 
        }

        // Updates the circular progress indicator during file processing (I/O)
        function updateProgressBar(percentage, message) {
            const safePercentage = Math.min(100, Math.max(0, Math.round(percentage)));
            const color = '#4f46e5'; 
            const trackColor = '#e0e7ff'; 
            
            circularProgressOuter.style.backgroundImage = `conic-gradient(${color} ${safePercentage}%, ${trackColor} ${safePercentage}%)`;
            progressPercentage.textContent = `${safePercentage}%`;

            if (safePercentage > 0 && safePercentage < 100) {
                circularProgressContainer.classList.remove('hidden');
                resumeInput.value = `${message} (${safePercentage}%)`;
            } else {
                circularProgressContainer.classList.add('hidden');
            }
        }
        
        // Toggles the UI state for the resume input during file loading
        function setLoadingState(isLoading) {
            if (isLoading) {
                resumeInputContainer.classList.add('loading-active');
                resumeInput.classList.add('loading-status');
                fileInput.disabled = true; 
                analyzeButton.disabled = true;
                loadingMessage.classList.add('hidden');
                statusMessage.classList.add('hidden');
                resumeInput.value = 'Starting file processing...'; 
            } else {
                resumeInputContainer.classList.remove('loading-active');
                resumeInput.classList.remove('loading-status');
                fileInput.disabled = false;
                circularProgressContainer.classList.add('hidden');
                loadingMessage.classList.add('hidden');
                updateProgressBar(0, '');
                checkInputs();
            }
        }

        // Helper to enable/disable the main analysis button based on inputs
        function checkInputs() {
            const resumeText = resumeInput.value.trim();
            const selectedRole = jobRoleInput.value.trim(); 

            const isReady = resumeText.length > 50 && selectedRole.length > 2 && loadingMessage.classList.contains('hidden') && !resumeInput.classList.contains('loading-status');
            analyzeButton.disabled = !isReady;
            
            if (!isReady && loadingMessage.classList.contains('hidden')) {
                const message = (selectedRole.length <= 2) 
                    ? 'Please type or select a target role.' 
                    : 'Please provide resume text (from upload or paste).';
                statusMessage.textContent = message;
                statusMessage.classList.remove('hidden');
            } else {
                statusMessage.classList.add('hidden');
            }
        }
        
        // Helper to normalize text for comparison
        function normalizeText(text) {
            // Remove punctuation but preserve spaces
            return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
        }

        // Handles PDF text extraction
        async function extractTextFromPdf(file) {
            return new Promise(async (resolve, reject) => {
                const fileReader = new FileReader();
                fileReader.onload = async function() {
                    try {
                        const typedarray = new Uint8Array(this.result);
                        updateProgressBar(5, 'Loading PDF Document');
                        const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
                        let fullText = '';
                        for (let i = 1; i <= pdf.numPages; i++) {
                            const progressBase = 5 + ((i - 1) / pdf.numPages) * 90;
                            updateProgressBar(progressBase, `Parsing Page ${i} of ${pdf.numPages}`);
                            const page = await pdf.getPage(i);
                            const textContent = await page.getTextContent();
                            fullText += textContent.items.map(s => s.str).join(' ') + '\n\n';
                        }
                        updateProgressBar(100, 'Extraction Complete!');
                        resolve(fullText.trim());
                    } catch (e) { reject(e); }
                };
                fileReader.onerror = reject;
                fileReader.readAsArrayBuffer(file);
            });
        }

        // Handles Image OCR (Tesseract)
        async function extractTextFromImage(file) {
            const { data: { text } } = await Tesseract.recognize(
                file, 'eng', { 
                    logger: m => {
                        let percentage = 0;
                        let statusMessage = '';
                        if (m.status === 'recognizing') {
                            percentage = 30 + (m.progress * 70);
                            statusMessage = `OCR: Recognizing Text`;
                        } else if (m.status === 'loading core' || m.status === 'loading language traineddata') {
                            percentage = m.progress * 30;
                            statusMessage = 'OCR: Loading Core Data (Slow on first use)';
                        } else if (m.status === 'initializing') {
                            statusMessage = 'OCR Engine Initializing...';
                        }
                        
                        if (percentage > 0) {
                            updateProgressBar(percentage, statusMessage);
                        } else if (statusMessage) {
                             resumeInput.value = statusMessage; 
                        }
                    }
                }
            );
            return text;
        }

        // Main file upload handler
        async function handleFileUpload(event) {
            const file = event.target.files[0];
            if (!file) { resumeInput.value = ""; setLoadingState(false); return; }

            const mimeType = file.type;
            let fullText = "";
            setLoadingState(true);

            try {
                if (mimeType === "application/pdf") {
                    fullText = await extractTextFromPdf(file);
                } else if (mimeType.startsWith("image/") && (mimeType.includes("png") || mimeType.includes("jpeg"))) {
                    fullText = await extractTextFromImage(file);
                } else {
                    throw new Error(`Unsupported file type: ${mimeType}.`);
                }
                
                if (fullText.trim().length < 50) {
                     throw new Error("Text extraction failed. File content was too short or unreadable.");
                }

                resumeInput.value = fullText.trim();
                
            } catch (error) {
                console.error("Error during file processing:", error);
                resumeInput.value = `Error: Could not process file (${error.message}). Please try pasting the text manually.`;
                statusMessage.textContent = `File processing failed.`;
                statusMessage.classList.remove('hidden');
            } finally {
                setLoadingState(false);
                fileInput.value = '';
            }
        }
        
        
        // ---------------------------------------------------------------------------------------------
        // --- SECTION 2: CORE AI / ANALYSIS LOGIC (Simulated LLM) ---
        
        /** * This data structure represents the knowledge base (the LLM's understanding 
         * of job requirements). 
         */
        const RECRUITER_DATA = {
            "Select Role": { required_skills: [], description: "Select a job role to begin comparison and see the required skill set.", suggestions: [] },
    "Data Analyst": {
        required_skills: [
            "Python", "SQL", "Excel", "Data Visualization", "Tableau", "Power BI", "Statistics", "R", 
            "GCP", "Azure", "Communication", "ETL", "Data Cleaning", "Dashboarding"
        ],
        description: "Analyze large datasets, develop reports, and build dashboards to drive business decisions. Strong focus on ETL, visualization, and data integrity."
    },

    "Web Developer": {
        required_skills: [
            "HTML", "CSS", "JavaScript", "React", "Node.js", "Git", "Tailwind CSS", "REST API", 
            "Database", "Responsive Design", "Security", "MongoDB", "Express.js", "TypeScript"
        ],
        description: "Develop and maintain high-performance, responsive web applications using modern full-stack frameworks."
    },

    "Machine Learning Engineer": {
        required_skills: [
            "Python", "TensorFlow", "Pandas", "Machine Learning", "Numpy", "Deep Learning", 
            "Docker", "Kubernetes", "Scala", "Linear Algebra", "Cloud", "MLOps", "Feature Engineering"
        ],
        description: "Design, build, and deploy ML models into production environments at scale. Requires deep understanding of algorithms and deployment."
    },

    "AI Researcher": {
        required_skills: [
            "Python", "Deep Learning", "Transformers", "LLMs", "PyTorch", "Mathematics", 
            "NLP", "Reinforcement Learning", "Research Writing", "Data Processing"
        ],
        description: "Conduct research and experiments on AI models, publish findings, and push boundaries of state-of-the-art algorithms."
    },

    "Data Scientist": {
        required_skills: [
            "Python", "Statistics", "Machine Learning", "Data Wrangling", "Visualization", 
            "Pandas", "Scikit-learn", "Deep Learning", "Feature Engineering", "A/B Testing", 
            "BigQuery", "Communication"
        ],
        description: "Extract insights from data using statistics and ML. Communicate data-driven recommendations to stakeholders."
    },

    "DevOps Engineer": {
        required_skills: [
            "Docker", "Kubernetes", "AWS", "Azure", "CI/CD", "Linux", "Terraform", "Networking", 
            "Scripting", "Monitoring", "Ansible", "Jenkins", "Security"
        ],
        description: "Automate infrastructure, manage deployments, and ensure reliable software delivery pipelines."
    },

    "Cybersecurity Analyst": {
        required_skills: [
            "Network Security", "Ethical Hacking", "Incident Response", "Risk Assessment", 
            "SIEM", "Firewalls", "Python", "Encryption", "Security Audits", "Compliance"
        ],
        description: "Monitor systems, identify vulnerabilities, and secure infrastructure from cyber threats."
    },

    "Project Manager": {
        required_skills: [
            "Scrum", "Agile", "Budget Management", "Risk Assessment", "Stakeholder Communication", 
            "JIRA", "Conflict Resolution", "PMP", "Leadership", "Scheduling", "Documentation"
        ],
        description: "Lead complex projects from initiation through closure, managing timelines, resources, and cross-functional teams."
    },

    "UX Designer": {
        required_skills: [
            "Figma", "Sketch", "Prototyping", "User Research", "Wireframing", "Usability Testing", 
            "Information Architecture", "Design Systems", "Accessibility", "Collaboration"
        ],
        description: "Design intuitive and effective user experiences, conducting research and testing to validate design choices."
    },

    "Sales Manager": {
        required_skills: [
            "CRM", "Forecasting", "Negotiation", "Lead Generation", "Pipeline Management", 
            "Coaching", "Sales Strategy", "HubSpot", "Outbound Sales", "Communication"
        ],
        description: "Manage and motivate a sales team, set strategic goals, and monitor performance to achieve revenue targets."
    },

    "Cloud Engineer": {
        required_skills: [
            "AWS", "Azure", "GCP", "Terraform", "Networking", "DevOps", "Python", 
            "Monitoring", "Security", "CI/CD", "Kubernetes"
        ],
        description: "Design and maintain scalable cloud infrastructure and automate deployments."
    },

    "Business Analyst": {
        required_skills: [
            "SQL", "Excel", "Tableau", "Power BI", "Data Modeling", "Communication", 
            "Process Improvement", "Documentation", "Stakeholder Analysis"
        ],
        description: "Analyze business processes and requirements, turning data insights into actionable improvements."
    }
};

        /**
         * Generates short, efficient advice focusing on action verbs and quantifiable results.
         */
        function getResumeAdvice(resumeText, role) {
        const B = (text) => `<strong>${text}</strong>`; // Bold helper
        const normalizedResume = resumeText.toLowerCase();

        const roleData = RECRUITER_DATA[role];
        if (!roleData) return {
            advice: `Cannot generate advice: unknown role.`,
            example: `Ensure your resume has clear sections, action verbs, quantified results, and keywords aligned with the job.`
        };

        const requiredSkills = roleData.required_skills.map(s => s.toLowerCase());

    // Check which skills are missing
const missingSkills = requiredSkills.filter(skill => !normalizedResume.includes(skill.toLowerCase()));

let advice = '';
let example = '';
let advicePoints = [];

// Section & structure advice
if (!/skills/i.test(resumeText)) {
    advicePoints.push(`Include a ${B('Skills')} section listing both hard and soft skills relevant to ${role}.`);
}
if (!/projects|experience/i.test(resumeText)) {
    advicePoints.push(`Add detailed ${B('Projects')} or ${B('Experience')} sections, emphasizing measurable outcomes.`);
}

// Keywords advice
if (missingSkills.length > 0) {
    advicePoints.push(`Incorporate keywords such as ${B(missingSkills.join(', '))} to align with the target role.`);
}

// Action verbs and measurable impact advice
advicePoints.push(`Rephrase bullet points using ${B('action verbs')} and quantify results wherever possible (e.g., "Improved system performance by 30%").`);

// Formatting and readability advice
advicePoints.push(`Ensure ${B('consistent formatting')}, clear headings, bullet points, and readability for recruiters and ATS.`);

// Join advice with numbering + line breaks
advice = advicePoints
    .map((point, index) => `${index + 1}. ${point}`)
    .join('<br>');

// Example bullet point suggestion
example = `*Example:* ${B('Developed')} a data analysis pipeline using ${B('Python')} and ${B('SQL')} that reduced processing time by ${B('45%')} for weekly reports.`;

// Return
return { advice, example };
        }


        /**
         * CORE ANALYTICAL FUNCTION: SIMULATES THE LLM'S SCORING
         * This function performs the comparison and generates the final structured report data.
         */
        function compareResume() {
            if (!loadingMessage.classList.contains('hidden')) return;

            const resumeText = normalizeText(resumeInput.value);
            const selectedRole = jobRoleInput.value.trim();

            if (!resumeText || selectedRole.length < 3) return;
            
            loadingMessage.classList.remove('hidden');
            document.getElementById('loadingText').textContent = "Analyzing Keywords...";
            analyzeButton.disabled = true;
            analyzeButton.textContent = "Analyzing...";

            // Determine requirements from RECRUITER_DATA
            const requirements = RECRUITER_DATA[selectedRole];
            let skillsToUse;
            let descriptionForReport = selectedRole;

            if (requirements) {
                skillsToUse = requirements.required_skills;
            } else {
                skillsToUse = ["Leadership", "Communication", "Problem Solving", "Strategy", "Project Management", "Data Analysis", "Client Relations"];
                descriptionForReport += " (Generic Keywords)";
            }

            // Keyword Matching (The core "AI" task)
            const requiredSkills = skillsToUse.map(s => s.toLowerCase());
            const matchingSkills = [];
            const missingSkills = [];

            requiredSkills.forEach(skill => {
                // Check for the presence of the skill name (normalized)
                if (resumeText.includes(normalizeText(skill))) {
                    matchingSkills.push(skill);
                } else {
                    missingSkills.push(skill);
                }
            });

            // Calculate score
            const totalRequired = requiredSkills.length;
            const matchCount = matchingSkills.length;
            const matchScore = totalRequired > 0 ? Math.round((matchCount / totalRequired) * 100) : 0;


            // --- REPORT GENERATION (Rendering the LLM Output) ---
            const matchScoreCircle = document.getElementById('matchScoreCircle');
            const scoreComment = document.getElementById('scoreComment');
            const missingSkillsList = document.getElementById('missingSkillsList');
            const suggestionsList = document.getElementById('suggestionsList');
            const reportRole = document.getElementById('reportRole');

            reportRole.textContent = descriptionForReport;
            matchScoreCircle.textContent = `${matchScore}%`;
            document.getElementById('missingCount').textContent = missingSkills.length;

            missingSkillsList.innerHTML = '';
            suggestionsList.innerHTML = '';


            let scoreColor = 'bg-gray-400';
            let commentText = 'Running analysis.';
            if (matchScore >= 80) { scoreColor = 'bg-green-600'; commentText = 'Excellent Match! You are highly competitive.'; } 
            else if (matchScore >= 50) { scoreColor = 'bg-yellow-600'; commentText = 'Good Match. Focus on strengthening key areas.'; } 
            else if (matchScore > 0) { scoreColor = 'bg-red-600'; commentText = 'Significant Gap. Review required skills thoroughly.'; }

            matchScoreCircle.className = `w-20 h-20 flex items-center justify-center rounded-full text-2xl font-extrabold text-white ${scoreColor}`;
            scoreComment.textContent = commentText;

            if (missingSkills.length === 0) {
                missingSkillsList.innerHTML = '<li class="italic text-gray-500 p-2">No critical missing skills found. Great job!</li>';
                 suggestionsList.innerHTML = '<p class="italic text-gray-500">All key skills matched! Focus on refining your bullet points to show quantifiable impact (e.g., increased revenue by 15%).</p>';

            } else {
                
                // 1. Populate Missing Skills list (Left Column) - With Inline Roadmap
                document.getElementById('loadingText').textContent = "Generating Personalized Advice and Roadmaps...";
                
                missingSkills.forEach(skill => {
                    const skillUpper = skill.toUpperCase();
                    
                    const li = document.createElement('li');
                    // Removed 'border-b' from the LI class to avoid duplicate lines with 'divide-y' on the UL
                    li.className = 'flex flex-col cursor-pointer transition duration-150 roadmap-toggle-li';
                    
                    // Main Skill Display Row
                    const mainRow = document.createElement('div');
                    mainRow.className = 'flex items-center justify-between text-red-700 font-medium p-3 hover:bg-red-100';
                    mainRow.setAttribute('onclick', `renderRoadmap('${skill}', this.closest('li'))`);
                    mainRow.innerHTML = `
                        <span class="flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2 flex-shrink-0 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            ${skillUpper}
                        </span>
                        <!-- Roadmap Icon -->
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-indigo-600 roadmap-toggle-icon flex-shrink-0 ml-2 transform transition duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.404 10.082 5 9 5c-4 0-4 4-4 8 0 1.082.75 1.832 2 2.75v1c0 1.33 1.34 2.16 3 2.5v1m0-13c1.168-.846 1.918-1.253 3-1.253 4 0 4 4 4 8 0 1.082-.75 1.832-2 2.75v1c0 1.33-1.34 2.16-3 2.5v1m-6-10h6"/>
                        </svg>
                    `;
                    
                    // Inline Roadmap Content Container (Initially Hidden)
                    const roadmapContentDiv = document.createElement('div');
                    roadmapContentDiv.className = 'inline-roadmap-content hidden p-3 pb-4 bg-red-50 border-t border-red-300';

                    li.appendChild(mainRow);
                    li.appendChild(roadmapContentDiv);
                    missingSkillsList.appendChild(li);
                });


                // 2. Populate Suggestions list (Right Column) - COMBINED ADVICE
                let combinedSuggestionsHTML = '<div class="space-y-4">';

                // Use a Map to dedupe advice by the advice text
                const uniqueAdviceSet = new Map();

                let addedOne = false;
                missingSkills.forEach(skill => {
                if (addedOne) return; // stop after one
                    const advice = getResumeAdvice(`${resumeInput.value} ${skill}`, selectedRole);
                if (advice && advice.advice && !uniqueAdviceSet.has(advice.advice.trim().toLowerCase())) {
                    uniqueAdviceSet.set(advice.advice.trim().toLowerCase(), advice);
                    addedOne = true; // only one suggestion total
                 }
                });


                // Fallback if nothing produced
                if (uniqueAdviceSet.size === 0) {
                    uniqueAdviceSet.set(
                        'Ensure your resume has a clear Summary, Skills, and Experience/Projects section, and quantify your achievements.',
                        { advice: 'Ensure your resume has a clear Summary, Skills, and Experience/Projects section, and quantify your achievements.', example: 'Example: Developed a data pipeline using Python and SQL that reduced processing time by 45%.' }
                    );
                }

                // Iterate over the unique advice objects
                let index = 0;
                uniqueAdviceSet.forEach(entry => {
                    index++;
                    combinedSuggestionsHTML += `
                        <div class="p-4 border border-indigo-200 rounded-lg bg-white shadow-sm">
                            <p class="text-sm text-gray-600">${entry.advice}</p>
                            <div class="mt-2 p-3 bg-indigo-50 border-l-4 border-indigo-400 text-sm">
                                <span class="font-semibold text-indigo-800">Example Bullet Point (CAR Method):</span>
                                <p class="text-gray-700 italic">${entry.example}</p>
                            </div>
                        </div>
                    `;
                });

                combinedSuggestionsHTML += '</div>';
                suggestionsList.innerHTML = combinedSuggestionsHTML;
            }

            document.getElementById('resultsSection').classList.remove('hidden');

            loadingMessage.classList.add('hidden');
            analyzeButton.disabled = false;
            analyzeButton.textContent = "Generate Match Report";
            document.getElementById('loadingText').textContent = "Analyzing..."; // Reset default message
        }
        
        
        // --- Initialization ---
        window.onload = function() {
            populateJobRoles();
            jobRoleInput.addEventListener('input', updateJobDescription); 
            resumeInput.addEventListener('input', checkInputs);
            updateJobDescription();
        }

        // Populates the datalist options (UI helper)
        function populateJobRoles() {
            const jobRolesList = document.getElementById('jobRolesList');
            jobRolesList.innerHTML = '';
            Object.keys(RECRUITER_DATA).forEach(role => {
                if (role !== "Select Role") { 
                    const option = document.createElement('option');
                    option.value = role;
                    jobRolesList.appendChild(option);
                }
            });
        }
        
        // Updates the job description when a role is selected (UI helper)
        function updateJobDescription() {
            const selectedRole = jobRoleInput.value.trim();
            const data = RECRUITER_DATA[selectedRole];
            
            if (data) {
                jobDescriptionContainer.classList.remove('hidden');
                jobDescriptionElement.textContent = data.description;
            } else if (selectedRole.length > 2) {
                jobDescriptionContainer.classList.remove('hidden');
                jobDescriptionElement.textContent = `Custom Role: Analysis will use a general set of high-impact keywords.`;
            } else {
                jobDescriptionContainer.classList.add('hidden');
            }
            checkInputs(); 
        }

    