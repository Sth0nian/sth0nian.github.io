$( document ).ready(function() {
    console.log( "jq loaded" );
    function hideall(){
        $("#html-sections").children().each(function(){
        $(this).hide()
    })}
    hideall()
    $(".kingho").show()
    $(".btn").on( "click", function() {
        hideall()
        console.log($(this).attr("t"))
        $("."+$(this).attr("t")).show()
      } );
});