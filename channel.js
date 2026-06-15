const { createClient } = supabase;

const supabaseClient = createClient(
  "https://olyuzdwaeilrxvqfsgju.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9seXV6ZHdhZWlscnh2cWZzZ2p1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwMjQ1ODAsImV4cCI6MjA4NjYwMDU4MH0.wVynFRV7IWKZwp3kl7PO6B5uWP535CoojZ9wVxcsJM4"
);

const params    = new URLSearchParams(location.search);
const channelId = params.get("id");

// =====================
// BADGE SYSTEM
// Badge shown next to username based on watcher count
// Special override for NightClipsOfficial
// =====================
const WATCHER_BADGES = [
  { min: 1000000, img: "https://iili.io/Cn6SkHG.png",      alt: "1m Watchers" },
  { min: 500000, img: "https://iili.io/Cn6SOSs.png",      alt: "500k Watchers" },
  { min: 100000, img: "https://iili.io/Cn6SvRf.png",      alt: "100k Watchers" },
  { min: 10000, img: "https://iili.io/qjDTvbR.png",      alt: "10k Watchers" },
  { min: 1000,  img: "https://iili.io/qjDTOJa.png",     alt: "1k Watchers"  },
  { min: 100,   img: "https://iili.io/qjDTSxp.png",      alt: "100 Watchers" },
];
const CREATOR_BADGE = { img: "https://iili.io/Cn6Xwp1.webp", alt: "Creator" };

function getBadgeForUser(username, watcherCount, override) {
  if (username === "NightClipsOfficial") return CREATOR_BADGE;
  const effective = (override !== null && override !== undefined) ? override : watcherCount;
  for (const b of WATCHER_BADGES) {
    if (effective >= b.min) return b;
  }
  return null;
}

// Build a badge <img> element
function makeBadgeEl(badge) {
  const img = document.createElement("img");
  img.src       = badge.img;
  img.alt       = badge.alt;
  img.className = "username-badge";
  img.title     = badge.alt;
  return img;
}

// =====================
// HELPERS
// =====================
function cleanTitle(t) { return (t || "").replace(/\s*\[.+\]\s*$/, "").trim(); }

function avatarNode(url) {
  if (url) {
    const img = document.createElement("img");
    img.className = "chan-avatar"; img.src = url; img.alt = "";
    return img;
  }
  const div = document.createElement("div");
  div.className   = "chan-avatar-ph";
  div.textContent = "?";
  return div;
}

async function countViewsForUploads(uploadIds) {
  if (uploadIds.length === 0) return {};
  const { data, error } = await supabaseClient
    .from("upload_views").select("upload_id").in("upload_id", uploadIds);
  if (error) return {};
  const map = {};
  (data || []).forEach(v => { map[v.upload_id] = (map[v.upload_id] || 0) + 1; });
  return map;
}

async function countLikesForUploads(uploadIds) {
  if (uploadIds.length === 0) return {};
  const { data, error } = await supabaseClient
    .from("upload_reactions").select("upload_id, value").in("upload_id", uploadIds);
  if (error) return {};
  const map = {};
  (data || []).forEach(r => { if (r.value === 1) map[r.upload_id] = (map[r.upload_id] || 0) + 1; });
  return map;
}

function renderUploadCard(file, views = 0, likes = 0) {
  const card = document.createElement("div");
  card.className = "card";

  const mediaLink = document.createElement("a");
  mediaLink.href      = `/NightClips/watch.html?id=${file.id}`;
  mediaLink.className = "card-media-link";

  const isImage   = file.file_type && file.file_type.startsWith("image");
  const thumbPath = file.thumbnail_path || file.file_path;
  const thumbUrl  = supabaseClient.storage.from("public-files").getPublicUrl(thumbPath).data.publicUrl;

  const img = document.createElement("img");
  img.className = "card-thumb"; img.alt = "";
  if (isImage) img.style.aspectRatio = "auto";

  if (file.thumbnail_path) {
    img.src = thumbUrl;
  } else if (!isImage) {
    // Capture a live frame for videos with no stored thumbnail
    img.style.background = "#0d0d0d";
    const videoUrl = supabaseClient.storage.from("public-files").getPublicUrl(file.file_path).data.publicUrl;
    attachFrameFromUrl(videoUrl, img);
  } else {
    img.src = thumbUrl;
  }

  mediaLink.appendChild(img);
  card.appendChild(mediaLink);

  const titleRow = document.createElement("div");
  titleRow.className    = "card-title-row";
  titleRow.style.cursor = "pointer";
  titleRow.onclick      = () => { window.location.href = `/NightClips/watch.html?id=${file.id}`; };

  const textWrap = document.createElement("div");
  textWrap.className = "card-title-text";

  const titleEl = document.createElement("p");
  titleEl.className   = "vid-title";
  titleEl.textContent = cleanTitle(file.title);
  textWrap.appendChild(titleEl);

  const meta = document.createElement("p");
  meta.className   = "vid-uploader";
  meta.textContent = `${views} view${views !== 1 ? "s" : ""} · ${likes} like${likes !== 1 ? "s" : ""}`;
  textWrap.appendChild(meta);

  titleRow.appendChild(textWrap);
  card.appendChild(titleRow);
  return card;
}

// Live frame capture for cards without stored thumbnails
function attachFrameFromUrl(videoUrl, imgEl) {
  const video       = document.createElement("video");
  video.src         = videoUrl;
  video.crossOrigin = "anonymous";
  video.muted       = true;
  video.playsInline = true;
  video.preload     = "metadata";
  video.addEventListener("loadedmetadata", () => {
    video.currentTime = Math.min(1, video.duration * 0.1);
  });
  video.addEventListener("seeked", () => {
    try {
      const canvas  = document.createElement("canvas");
      canvas.width  = video.videoWidth  || 640;
      canvas.height = video.videoHeight || 360;
      canvas.getContext("2d").drawImage(video, 0, 0);
      imgEl.src = canvas.toDataURL("image/jpeg", 0.85);
    } catch (e) { console.warn("Frame capture blocked:", e); }
    video.src = "";
  });
  video.addEventListener("error", () => { video.src = ""; });
  video.load();
}

// =====================
// WATCH BUTTON LOGIC
// =====================
async function getAuthUser() {
  const { data } = await supabaseClient.auth.getUser();
  return data?.user || null;
}

async function getWatcherCount(channelId) {
  const { count } = await supabaseClient
    .from("watches")
    .select("id", { count: "exact", head: true })
    .eq("channel_id", channelId);
  return count || 0;
}

async function isWatching(channelId, watcherId) {
  const { data } = await supabaseClient
    .from("watches")
    .select("id")
    .eq("channel_id", channelId)
    .eq("watcher_id", watcherId)
    .maybeSingle();
  return !!data;
}

function formatWatchers(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1000)    return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}

async function setupWatchButton(channelId, username, watcherCount, watcherOverride) {
  const authUser    = await getAuthUser();
  const btn         = document.getElementById("watchBtn");
  const countEl     = document.getElementById("watcherCount");
  const displayCount = (watcherOverride !== null && watcherOverride !== undefined)
    ? watcherOverride : watcherCount;

  countEl.textContent = formatWatchers(displayCount) + " watching";

  // Don't show watch button on your own channel
  if (!authUser || authUser.id === channelId) {
    btn.style.display = "none";
    return;
  }

  let watching = await isWatching(channelId, authUser.id);
  updateWatchBtn(btn, watching);

  btn.onclick = async () => {
    btn.disabled = true;

    if (watching) {
      await supabaseClient.from("watches")
        .delete().eq("channel_id", channelId).eq("watcher_id", authUser.id);
      watching = false;
    } else {
      await supabaseClient.from("watches")
        .insert({ channel_id: channelId, watcher_id: authUser.id });
      watching = true;
    }

    // Refresh count — if override is set, keep showing it
    const newCount     = await getWatcherCount(channelId);
    const displayCount = (watcherOverride !== null && watcherOverride !== undefined)
      ? watcherOverride : newCount;
    countEl.textContent = formatWatchers(displayCount) + " watching";

    // Refresh badge
    const badge = getBadgeForUser(username, newCount);
    const badgeWrap = document.getElementById("chanBadge");
    badgeWrap.innerHTML = "";
    if (badge) badgeWrap.appendChild(makeBadgeEl(badge));

    updateWatchBtn(btn, watching);
    btn.disabled = false;
  };
}

function updateWatchBtn(btn, watching) {
  if (watching) {
    btn.textContent = "Watching";
    btn.classList.add("watching");
  } else {
    btn.textContent = "Watch";
    btn.classList.remove("watching");
  }
}

// =====================
// INIT
// =====================
async function init() {
  if (!channelId) {
    document.body.innerHTML = `<div style="padding:40px;color:#666;">No channel specified.</div>`;
    return;
  }

  const { data: user } = await supabaseClient
    .from("users").select("id, username, profile_pic_url, description, watcher_override")
    .eq("id", channelId).maybeSingle();

  if (!user) {
    document.body.innerHTML = `<div style="padding:40px;color:#666;">Channel not found.</div>`;
    return;
  }

  const username     = user.username || "Unknown";
  const watcherCount = await getWatcherCount(channelId);

  // Page title
  document.title = username + " · NightClips";

  // Channel name + badge
  document.getElementById("chanName").textContent = username;
  document.getElementById("chanDesc").textContent = user.description || "";

  const badgeWrap = document.getElementById("chanBadge");
  const badge     = getBadgeForUser(username, watcherCount, user.watcher_override ?? null);
  if (badge) badgeWrap.appendChild(makeBadgeEl(badge));

  // Avatar
  const avWrap = document.getElementById("chanAvatar");
  avWrap.innerHTML = "";
  avWrap.appendChild(avatarNode(user.profile_pic_url));

  // Uploads
  const { data: uploads, error } = await supabaseClient
    .from("uploads").select("*").eq("user_id", channelId).order("created_at", { ascending: false });
  if (error) { console.error(error); return; }

  const list = uploads || [];
  document.getElementById("uploadCount").textContent = String(list.length);

  const ids = list.map(u => u.id);
  const [viewsMap, likesMap] = await Promise.all([
    countViewsForUploads(ids),
    countLikesForUploads(ids),
  ]);

  const totalViews = ids.reduce((sum, id) => sum + (viewsMap[id] || 0), 0);
  document.getElementById("totalViews").textContent = String(totalViews);

  // Setup watch button (needs watcherCount)
  await setupWatchButton(channelId, username, watcherCount, user.watcher_override ?? null);

  // Most viewed (top 1)
  const mostViewed     = [...list].sort((a, b) => (viewsMap[b.id] || 0) - (viewsMap[a.id] || 0)).slice(0, 1);
  const mostViewedWrap = document.getElementById("mostViewed");
  mostViewedWrap.innerHTML = "";
  mostViewed.length
    ? mostViewed.forEach(f => mostViewedWrap.appendChild(renderUploadCard(f, viewsMap[f.id] || 0, likesMap[f.id] || 0)))
    : (mostViewedWrap.innerHTML = `<p class="empty-msg">No uploads yet.</p>`);

  // Most liked (top 6)
  const mostLiked     = [...list].sort((a, b) => (likesMap[b.id] || 0) - (likesMap[a.id] || 0)).slice(0, 6);
  const mostLikedWrap = document.getElementById("mostLiked");
  mostLikedWrap.innerHTML = "";
  mostLiked.length
    ? mostLiked.forEach(f => mostLikedWrap.appendChild(renderUploadCard(f, viewsMap[f.id] || 0, likesMap[f.id] || 0)))
    : (mostLikedWrap.innerHTML = `<p class="empty-msg">No uploads yet.</p>`);

  // All uploads
  const allWrap = document.getElementById("allUploads");
  allWrap.innerHTML = "";
  list.length
    ? list.forEach(f => allWrap.appendChild(renderUploadCard(f, viewsMap[f.id] || 0, likesMap[f.id] || 0)))
    : (allWrap.innerHTML = `<p class="empty-msg">No uploads yet.</p>`);
}

init();
