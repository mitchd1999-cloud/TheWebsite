// --- DOM ELEMENTS ---
const links = document.querySelectorAll('.nav-link');
const sections = document.querySelectorAll('.page');
const learnMoreBtn = document.getElementById('learnMoreBtn');
const caseFilesBtn = document.getElementById('caseFilesBtn');
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modalTitle');
const modalDescription = document.getElementById('modalDescription');
const modalStatusBadge = document.getElementById('modalStatusBadge');
const modalBudget = document.getElementById('modalBudget');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const contactForm = document.getElementById('contactForm');
const formStatus = document.getElementById('formStatus');

// --- DATA VARIABLE ---
let projects = [];

// --- CITY MAPPING FOR PINS ---
const projectLocations = {
  "Highway Expansion": "Highway 401, Toronto, ON",
  "Airport Terminal": "Calgary International Airport, 2000 Airport Rd NE, Calgary, AB",
  "Hospital Construction": "1051 Rue Sanguinet, Montréal, QC", // CHUM Hospital
  "Fiber Optic Network": "Portage and Main, Winnipeg, MB",
  "Flood Mitigation System": "Halifax Waterfront, Halifax, NS",
  "Bridge Renovation": "Alexandra Bridge, Ottawa, ON",
  "Metro Line Upgrade": "Montreal Metro, Montreal, QC",
  "Solar Farm": "Travers Solar Project, Lomond, AB",
  "Public Transit Expansion": "Broadway-City Hall Station, Vancouver, BC",
  "Water Pipeline Upgrade": "Shoal Lake 40 First Nation, MB" // Source of Winnipeg's water
};

// --- API & DATA FETCHING ---
async function loadAllProjects() {
  const jsonUrl = 'https://temp.staticsave.com/693189b82d07e.json';
  const xmlUrl = 'https://temp.staticsave.com/693189a4413a7.xml';

  try {
    const [jsonResponse, xmlResponse] = await Promise.all([
      fetch(jsonUrl),
      fetch(xmlUrl)
    ]);

    // 1. Process JSON (Planned)
    const jsonData = await jsonResponse.json();
    const mappedJson = jsonData.map(item => ({
      title: item.Name,
      province: item.Province,
      // Lookup the city based on the name, or default to the Province if not found
      location: projectLocations[item.Name] || item.Province,
      budget: parseFloat(item.Budget),
      status: item.Status.toLowerCase().replace(' ', '-'), 
      descriptionShort: `Infrastructure planning for ${item.Province}.`,
      descriptionFull: `Full project scope for ${item.Name}. This project is currently in the ${item.Status} phase with a total allocated budget of $${item.Budget.toLocaleString()}.`,
    }));

    // 2. Process XML (In-Progress)
    const xmlText = await xmlResponse.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");
    const rows = Array.from(xmlDoc.querySelectorAll("ROW"));
    
    const mappedXml = rows.map(row => {
      const getVal = (tag) => row.querySelector(tag) ? row.querySelector(tag).textContent : '';
      const name = getVal("Name");
      return {
        title: name,
        province: getVal("Province"),
        // Lookup the city based on the name
        location: projectLocations[name] || getVal("Province"),
        budget: parseFloat(getVal("Budget")),
        status: getVal("Status").toLowerCase().replace(' ', '-'),
        descriptionShort: `Active development in ${getVal("Province")}.`,
        descriptionFull: `Ongoing operations for ${name}. This project is officially ${getVal("Status")} with a budget of $${parseFloat(getVal("Budget")).toLocaleString()}.`,
      };
    });

    projects = [...mappedJson, ...mappedXml];
    console.log("Data loaded successfully:", projects);

    const hash = window.location.hash.replace('#', '');
    showPage(hash || 'home');

  } catch (error) {
    console.error("Error loading project data:", error);
    alert("Failed to load project data from external sources.");
  }
}

// --- NAVIGATION ---
function showPage(pageId) {
  sections.forEach(sec => {
    sec.classList.add('hidden');
    if(sec.id === pageId) sec.classList.remove('hidden');
  });

  links.forEach(link => {
    link.classList.remove('active');
    if(link.dataset.page === pageId) {
      link.classList.add('active');
      const parentDropdown = link.closest('.dropdown');
      if(parentDropdown) parentDropdown.querySelector('.dropdown-toggle').classList.add('active');
    }
  });

  if (projects.length > 0) {
    if (pageId === 'planned-projects') populateProjects('planned');
    if (pageId === 'in-progress-projects') populateProjects('in-progress');
    if (pageId === 'project-stats') renderStats();
  }
  
  window.scrollTo(0, 0);
}

links.forEach(link => {
  link.addEventListener('click', e => {
    if(link.classList.contains('dropdown-toggle')) return;
    e.preventDefault();
    const page = link.dataset.page;
    showPage(page);
    history.pushState(null, null, `#${page}`);
  });
});

window.addEventListener('load', () => {
  loadAllProjects();
});

learnMoreBtn.addEventListener('click', () => { showPage('about'); history.pushState(null, null, `#about`); });
caseFilesBtn.addEventListener('click', () => { showPage('project-stats'); history.pushState(null, null, `#project-stats`); });

// --- PROJECT CARDS ---
function populateProjects(status) {
  const containerId = status === 'planned' ? 'plannedProjectsGrid' : 'inProgressProjectsGrid';
  const container = document.getElementById(containerId);
  if(!container) return;
  
  container.innerHTML = '';
  const filtered = projects.filter(p => p.status === status);
  
  if (filtered.length === 0) {
    container.innerHTML = '<p>No projects found in this category.</p>';
    return;
  }

  filtered.forEach(proj => {
    const card = document.createElement('div');
    card.className = 'project-card';
    card.innerHTML = `<h3>${proj.title}</h3><p>${proj.descriptionShort}</p><button class="view-btn">View Details</button>`;
    card.addEventListener('click', () => openModal(proj));
    container.appendChild(card);
  });
}

// --- STATS & BAR CHART ---
let chartInstance = null;
function renderStats() {
  const listContainer = document.getElementById('allProjectsList');
  if(!listContainer) return;
  listContainer.innerHTML = '';
  
  projects.forEach(p => {
    const li = document.createElement('li');
    const statusClass = p.status === 'planned' ? 'status-planned' : 'status-progress';
    const statusText = p.status === 'planned' ? 'Planned' : 'In Progress';
    const money = p.budget.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 });
    
    li.innerHTML = `<strong>${p.title}</strong><span class="budget">${money}</span><span class="status ${statusClass}">${statusText}</span>`;
    listContainer.appendChild(li);
  });

  const canvas = document.getElementById('projectsChart');
  const ctx = canvas.getContext('2d');

  if (canvas.parentElement) {
    canvas.parentElement.style.height = '600px';
  }

  if (chartInstance) chartInstance.destroy();

  const sortedProjects = [...projects].sort((a, b) => b.budget - a.budget);

  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sortedProjects.map(p => p.title),
      datasets: [{
        label: 'Project Budget ($)',
        data: sortedProjects.map(p => p.budget),
        backgroundColor: sortedProjects.map(p => p.status === 'planned' ? 'rgba(241, 196, 15, 0.7)' : 'rgba(46, 204, 113, 0.7)'),
        borderColor: sortedProjects.map(p => p.status === 'planned' ? '#f1c40f' : '#2ecc71'),
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255,255,255,0.1)' },
          ticks: { color: '#ccc', stepSize: 1000000 }
        },
        x: { ticks: { color: '#ccc', autoSkip: false, maxRotation: 45, minRotation: 45 } }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(context) {
              let label = context.dataset.label || '';
              if (label) { label += ': '; }
              if (context.parsed.y !== null) {
                label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(context.parsed.y);
              }
              return label;
            }
          }
        }
      }
    }
  });
}

// --- MODAL SYSTEM (Projects Only) ---

function openModal(project){
  modalTitle.textContent = project.title;
  modalDescription.textContent = project.descriptionFull;
  modalBudget.textContent = project.budget.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  
  const isPlanned = project.status === 'planned';
  modalStatusBadge.textContent = isPlanned ? "Phase: Planned" : "Phase: In Progress";
  modalStatusBadge.style.background = isPlanned ? "rgba(241, 196, 15, 0.2)" : "rgba(46, 204, 113, 0.2)";
  modalStatusBadge.style.color = isPlanned ? "#f1c40f" : "#2ecc71";
  
  // Ensure badges are visible
  modalStatusBadge.style.display = 'inline-block';
  modalBudget.style.display = 'inline-block';

  // --- NEW MAP LOGIC (PINPOINT) ---
  const mapContainer = document.getElementById('modalMapContainer');
  if(mapContainer) {
    const query = encodeURIComponent(project.location);
    
    // Inject the Google Maps iframe with a specific query
    mapContainer.innerHTML = `
      <iframe 
        width="100%" 
        height="300" 
        frameborder="0" 
        scrolling="no" 
        marginheight="0" 
        marginwidth="0" 
        style="border-radius: 8px; border: 1px solid #f1c40f; margin-top: 20px;"
        src="https://maps.google.com/maps?q=${query}&t=&z=13&ie=UTF8&iwloc=&output=embed"
      ></iframe>
    `;
  }
  
  modal.classList.remove('hidden');
  modal.classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closeModal(){
  modal.classList.remove('show');
  document.body.style.overflow = '';
  
  // FIXED GLITCH: Wait for animation to finish before clearing map
  setTimeout(() => {
    modal.classList.add('hidden');
    const mapContainer = document.getElementById('modalMapContainer');
    if(mapContainer) mapContainer.innerHTML = '';
  }, 300);
}

modalCloseBtn.addEventListener('click', closeModal);
modal.addEventListener('click', e => { if(e.target===modal) closeModal(); });
window.addEventListener('keydown', e => { if(e.key==='Escape') closeModal(); });

// --- CONTACT FORM SUBMISSION (WITH EMAILJS) ---
if(contactForm && formStatus) {
  contactForm.addEventListener('submit', function(e) {
    e.preventDefault(); // Stop page reload

    // 1. Change button text to indicate loading
    const submitBtn = contactForm.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerText;
    submitBtn.innerText = 'Sending...';

    // 🔴 REPLACE THESE TWO VARIABLES WITH YOUR ACTUAL IDS 🔴
    const serviceID = 'service_ryos5b4';
    const templateID = 'template_gat6woc';

    // 2. Send the email
    emailjs.sendForm(serviceID, templateID, this)
      .then(() => {
        // SUCCESS: Show the green message
        submitBtn.innerText = originalBtnText; // Reset button text
        formStatus.innerHTML = "✅ Message sent! We will get back to you soon.";
        formStatus.classList.add('show');
        contactForm.reset(); // Clear the inputs

        // Hide the message after 3 seconds
        setTimeout(() => {
          formStatus.classList.remove('show');
        }, 3000);

      }, (err) => {
        // ERROR: Show an alert
        submitBtn.innerText = originalBtnText;
        alert('Failed to send message. Please try again.');
        console.error('EmailJS Error:', err);
      });
  });
}

// --- DROPDOWN ---
document.querySelectorAll('.dropdown-toggle').forEach(toggle => {
  toggle.addEventListener('click', e => {
    e.preventDefault(); e.stopPropagation();
    toggle.parentElement.classList.toggle('open');
  });
});
document.addEventListener('click', () => document.querySelectorAll('.dropdown.open').forEach(drop => drop.classList.remove('open')));
