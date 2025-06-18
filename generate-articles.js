let fs = require("fs");
let files = fs.readdirSync("./articles");
readarticles();
function readarticles() {
  let data = [];

  fs.readdirSync("./articles", "utf8").forEach((file) => {
    let splitted = fs.readFileSync("./articles/" + file, "utf8").split(/\r?\n/);
    let dc = file.replace(".md", "").split("-");
    let datestring =
      dc[0] + "-" + dc[1] + "-" + dc[2] + "_" + dc[3] + ":" + dc[4];
    let title = splitted[0];
    let tags = splitted[1];
    splitted.shift();
    splitted.shift();
    splitted.shift();
    let body = splitted.filter(Boolean);
    data.push({
      title: title.replace("# ", "<h1>") + "</h1>",
      tags: tags.replace(/ /g, "").split(","),
      date: datestring.replace("_", " "),
      body: body,
    });
  });
  console.log(data);
  fs.writeFile(
    "articles.js",
    "let articles = " + JSON.stringify(data),
    (err) => {
      if (err) {
        console.error(err);
      } else {
        console.error("yay");
      }
    }
  );
  return data;
}
