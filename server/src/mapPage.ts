/** Public live-map page. Polls /m/:token/data every 10 seconds. */
export const mapPage = (token: string) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Live location</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="">
<style>html,body,#map{height:100%;margin:0}#s{position:fixed;z-index:1000;top:8px;left:8px;right:8px;background:#fff;padding:8px 12px;border-radius:6px;font:14px system-ui}</style>
</head><body><div id="s">Loading...</div><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
<script>
var map = L.map('map'), line = L.polyline([], {color:'#d33'}).addTo(map), dot, fitted;
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {attribution:'&copy; OpenStreetMap'}).addTo(map);
function tick(){
  fetch('/m/${token}/data').then(function(r){return r.json()}).then(function(d){
    var pts = d.points.map(function(p){return [p.lat,p.lng]});
    var last = d.points[d.points.length-1];
    var stale = last && Date.now() - new Date(last.at).getTime() > 600000;
    document.getElementById('s').textContent = (!d.active ? 'Sharing has ended. ' : stale ? 'No recent updates. If you received a newer link, use that one. ' : 'Live. ') +
      (last ? 'Last update ' + new Date(last.at).toLocaleTimeString() : 'Waiting for location');
    if(!last) return;
    line.setLatLngs(pts);
    if(dot) dot.setLatLng(pts[pts.length-1]); else dot = L.circleMarker(pts[pts.length-1],{radius:8,color:'#d33'}).addTo(map);
    if(!fitted){ map.setView(pts[pts.length-1],16); fitted=true; }
    if(d.active) setTimeout(tick,10000);
  }).catch(function(){ setTimeout(tick,10000) });
}
tick();
</script></body></html>`;
