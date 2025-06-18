$(document).ready(function () {
  composeArticles();
  addAllFunctions();

  function addAllFunctions(){
    $('.search').on('input',function(e){
      searcharticles($('.search').val())
  });
  }
});

function composeArticles(curatedarticles) {
  let aritclebody = "";
  let renderarticles
  if(curatedarticles != null){
    renderarticles = curatedarticles
  } else {
    renderarticles = articles
  }
  
  // Sort articles by date (newest first)
  renderarticles.sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    return dateB - dateA;
  });
  
  for (let i = 0; i < renderarticles.length; i++) {
      let bodystring = ""
      for (let j = 0 ; j < renderarticles[i].body.length ; j++){
        bodystring += renderarticles[i].body[j]+"<br><br>"
      }
    aritclebody =
      "<p class='title'>" +
      renderarticles[i].title +
      "</p>" +
      "<p class='date'>" +
      renderarticles[i].date +
      "</p>" +
      "<p class='body'>" +
      bodystring +
      "</p>" +
      "<p class='tags'>" +
      renderarticles[i].tags +
      "</p>" +
      "<hr>" +
      aritclebody;
  }
  $("#blogcontent").html(aritclebody);
}

function searcharticles(str){
  arts = [];
  console.log('Searching for: ' + str)
  if(str != ''){
    console.log('string not null')
    for(let k = 0 ; k < articles.length ; k++){
      // Check if title contains the search string
      let titleMatch = articles[k].title.toLowerCase().indexOf(str.toLowerCase()) > -1;
      
      // Check if any tag contains the search string
      let tagMatch = false;
      for(let tag of articles[k].tags) {
        if(tag.toLowerCase().indexOf(str.toLowerCase()) > -1) {
          tagMatch = true;
          break;
        }
      }
      
      if (titleMatch || tagMatch){
        arts.push(articles[k])
      }
    }
    console.log('matched articles: '+arts.length)
    composeArticles(arts)
  } else {
    composeArticles()
  }
}