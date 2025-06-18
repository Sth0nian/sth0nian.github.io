$(document).ready(function () {
  composeArticles();
  resetClickables();
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

function resetClickables() {
  // Hide all sections first
  $(".section").hide();
  
  // Reset all menu items to unselected
  $(".menubar").find("span").removeClass("selected");
  $(".menubar").find("span").addClass("unselected");
  
  // Show blog section by default
  $("#blog").show();
  $(".menubar").find("[identifier='blog']").removeClass("unselected").addClass("selected");
  
  // Handle internal navigation (spans)
  $(".menubar span.unselected").hover(function () {
    $(this).css("cursor", "pointer");
  });
  
  $(".menubar span.unselected").click(function () {
    $(".section").hide();
    $(".menubar").find("span").removeClass("selected");
    $(".menubar").find("span").addClass("unselected");
    $(this).removeClass("unselected").addClass("selected");
    $("#" + $(this).attr("identifier")).show();
    console.log("#" + $(this).attr("identifier") + " shown");
    resetClickables();
  });
  
  // Handle external links (anchors) - just add hover effect
  $(".menubar a.unselected").hover(function () {
    $(this).css("cursor", "pointer");
  });
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