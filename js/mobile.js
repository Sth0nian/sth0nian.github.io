$(document).ready(function() {
    console.log("jq loaded");
    
    function hideall() {
        $(".content-section").removeClass("active").hide();
        $(".btn").removeClass("active");
    }
    
    hideall();
    $(".content-section.kingho").addClass("active").show();
    $(".btn[t='kingho']").addClass("active");
    
    $(".btn").on("click", function() {
        hideall();
        const target = $(this).attr("t");
        console.log(target);
        $(".content-section." + target).addClass("active").show();
        $(this).addClass("active");
    });
});