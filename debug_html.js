const url = "https://new2.hdhub4u.cl/pritam-and-pedro-season-1-hindi-webrip-all-episodes/";
fetch(url).then(r => r.text()).then(html => {
  require('fs').writeFileSync('pritam.html', html);
  console.log("Saved pritam.html");
});
