$( document ).ready(function() {
    // format json to articles format
    function composeArticles(){
        let begin = "Ramblings of coder / writer / architect / amateur woodworker"
        let aritclebody = ""
        for(let i = 0 ; i < articles.length ; i++){
            aritclebody+="<p class='date'>"+articles[i].date+"</p>"+"<p class='title'>"+articles[i].title+"</p>"+"<p class='body'>"+articles[i].body+"</p>"+"<p class='tags'>"+articles[i].tags+"</p>"
        }
        $("#blog").html(begin+aritclebody)

    }
    function resetClickables(){
        $(".selected").click(false);
        $(".unselected").hover(function() {
            $(this).css('cursor','pointer');
        });
        $(".unselected").click(function(){
            $(".section").hide()
            $(".menubar").find('span').removeClass("selected")
            $(".menubar").find('span').addClass("unselected")
            $(this).addClass("selected")
            $(this).addClass("unselected")
            $("#"+$(this).attr("identifier")).show()
            console.log("#"+$(this).attr("identifier")+"shown")
            resetClickables()
        })
        $("#"+$("#selected").attr("identifier")).show()
    }

    // run functions to start site
    composeArticles()
    resetClickables()
})