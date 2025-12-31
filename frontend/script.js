/* ================= DOM ELEMENTS ================= */

const clipBtn = document.getElementById("clipBtn");
const urlInput = document.getElementById("youtubeUrl");
const startTime = document.getElementById("startTime");
const endTime = document.getElementById("endTime");
const clipNameInput = document.getElementById("clipName");
const clipsList = document.getElementById("clipsList");
const searchInput = document.getElementById("clipSearch");

/* ================= STATE ================= */

let currentPage = 1;
const PAGE_SIZE = 5;
let currentSearch = "";
let searchTimeout = null;

/* ================= TIME HELPERS ================= */

function timeToSeconds(str) {
  const parts = str.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return Number(str);
}

function formatDate(ms) {
  return new Date(ms).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

/* ================= LOAD CLIPS ================= */

async function loadClips(page = 1) {
  const res = await fetch(
    `http://localhost:3000/api/clips?page=${page}&limit=${PAGE_SIZE}&search=${encodeURIComponent(currentSearch)}`
  );
  const data = await res.json();
  renderClips(data);
}

/* ================= RENDER CLIPS ================= */

function renderClips(data) {
  currentPage = data.page;
  clipsList.innerHTML = "";

  if (!data.clips || data.clips.length === 0) {
    clipsList.innerHTML = "<li>No clips found</li>";
    return;
  }

  data.clips.forEach(({ name, duration, createdAt }) => {
    const li = document.createElement("li");
    li.className = "clip-row";

    const info = document.createElement("div");
    info.className = "clip-info";

    const link = document.createElement("a");
    link.href = `http://localhost:3000/clips/${name}`;
    link.textContent = name;
    link.target = "_blank";

    const meta = document.createElement("span");
    meta.className = "clip-duration";
    meta.textContent = ` (${duration}s · ${formatDate(createdAt)})`;

    info.appendChild(link);
    info.appendChild(meta);

    const actions = document.createElement("div");

    const share = document.createElement("button");
    share.className = "share-btn";
    share.textContent = "Share";
    share.onclick = async () => {
      await navigator.clipboard.writeText(link.href);
      alert("Clip link copied!");
    };

    const del = document.createElement("button");
    del.className = "delete-btn";
    del.textContent = "Delete";
    del.onclick = async () => {
      await fetch(
        `http://localhost:3000/api/clips/${name}`,
        { method: "DELETE" }
      );
      loadClips(currentPage);
    };

    actions.appendChild(share);
    actions.appendChild(del);

    li.appendChild(info);
    li.appendChild(actions);
    clipsList.appendChild(li);
  });

  /* ================= PAGINATION ================= */

  const nav = document.createElement("div");
  nav.className = "pagination";

  const prev = document.createElement("button");
  prev.className = "icon-btn";
  prev.textContent = "‹";
  prev.disabled = currentPage === 1;
  prev.onclick = () => {
    loadClips(currentPage - 1);
  };

  const label = document.createElement("span");
  label.className = "page-label";
  label.textContent = `Page ${data.page} of ${data.totalPages}`;

  const next = document.createElement("button");
  next.className = "icon-btn";
  next.textContent = "›";
  next.disabled = currentPage >= data.totalPages;
  next.onclick = () => {
    loadClips(currentPage + 1);
  };

  nav.appendChild(prev);
  nav.appendChild(label);
  nav.appendChild(next);
  clipsList.appendChild(nav);
}

/* ================= SEARCH ================= */

if (searchInput) {
  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimeout);

    searchTimeout = setTimeout(() => {
      currentSearch = searchInput.value.trim();
      loadClips(1);
    }, 300); // 300ms debounce
  });
}

/* ================= CREATE CLIP ================= */

clipBtn.addEventListener("click", async () => {
  const response = await fetch("http://localhost:3000/clip", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: urlInput.value,
      start: timeToSeconds(startTime.value),
      end: timeToSeconds(endTime.value),
      clipName: clipNameInput.value
    })
  });

  if (!response.ok) {
    alert("Failed to create clip");
    return;
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = clipNameInput.value + ".mp4";
  a.click();
  URL.revokeObjectURL(url);

  currentSearch = "";
  loadClips(1);
});

/* ================= INIT ================= */

loadClips();
