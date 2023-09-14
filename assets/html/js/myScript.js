

ivritFont=localStorage.getItem("ivritFont");
if (!ivritFont)
ivritFont=28;

othersFont=localStorage.getItem("othersFont");
if (!othersFont)
othersFont=23;

updateFont();





function updateFont()
{
	var html=document.getElementsByTagName('html')[0];
	
		console.log("CSS TEXT NULL OR NAN");
		cssText = "   --fontSizeIvrit:" +
        ivritFont +
        "px;" +
        "--fontSizeOthers:" +
        othersFont +
        "px;";
		
	

	console.log(cssText);
	html.style.cssText=cssText;
}




function accordionOpenClose(id)
{
	console.log("HELLLOOO");
    var panel =  document.getElementById(id);
    if (panel.style.maxHeight){
      panel.style.maxHeight = null;
    } else {
      panel.style.maxHeight = panel.scrollHeight + "px";
		} 


}

				
				function saveLastVisited()
				{
					localStorage.setItem('lastVisited',window.location.href);
				}
				
				function openNav() {
    document.getElementById("mySidenav").style.width = "50%";
	document.getElementById("mySidenav").style.border = "1px solid #31567f";
	document.getElementById("buttonNav").style.display = "none";
	}

			function closeNav() {
		document.getElementById("mySidenav").style.width = "0";
		document.getElementById("mySidenav").style.border = "0px";
		document.getElementById("buttonNav").style.display = "";
		
	}
				
				function hideShowById(id) {
				var x = document.getElementById(id);
				if (x.style.display === "none") {
					x.style.display = "";
				} else {
					x.style.display = "none";
				}
			}
			
			
				
				var activeClasses;
				
				
				
				
				function initClassesBasedOnCookies()
				{
					var origDist=0;
					var dist=0;
					var scaling=false;

					document.body.addEventListener("touchstart", function(e) {
						if (e.touches.length==2)
						{
							origDist= Math.hypot(
								e.touches[0].pageX - e.touches[1].pageX,
								e.touches[0].pageY - e.touches[1].pageY);
							scaling=true;
						}});

					document.body.addEventListener("touchmove", function(e) {
						if (scaling)
						{
						dist = Math.hypot(
							e.touches[0].pageX - e.touches[1].pageX,
							e.touches[0].pageY - e.touches[1].pageY);
						 }
						console.log(e);
					});

					document.body.addEventListener("touchend", function(e) {
						console.log(e);
						
						if (scaling)
						{
							scaling=false;
						console.log(e);
						console.log(e.touches.length);
						
						if (origDist>dist)
						{
							ivritFont--;
							othersFont--;
						}
						else
						{
							ivritFont++;
							othersFont++;
						}



						localStorage.setItem("ivritFont",ivritFont);
						localStorage.setItem("othersFont",othersFont);
						updateFont();

						dist=0;
						origDist=0;
						}
					});


				saveLastVisited();
				activeClasses = localStorage.getItem('actives');
				console.log(activeClasses);
				if (activeClasses==null)
				{
				activeClasses={onkelos:true,
								yonatan:true,
								passukEn:true,
								passukFr:false,
								rashi:true,
								siftey:true,
								ibnEzra:true,
								ramban:true,
								sforno:true,
								baalHaturim:true,
								orHaHaim:true,
								kliYakar:true,
								daatZkenim:true,
								haemekDavar:true,
								abarbanel:true,
								rashbam:true,
								malbim:true,
								ralbag:true,
								mezudatDavid:true,
								mezudatZion:true,
								passukFrHa:true,
								passukEnHa:true,
								rashiHa:true
								};
				localStorage.setItem('actives',JSON.stringify(activeClasses));
				}
				else
				{
				activeClasses=JSON.parse(activeClasses);
				}

				if (activeClasses["haemekDavar"]==null){ //update 1.3.4
					activeClasses["haemekDavar"]=true;
					activeClasses["abarbanel"]=true;
					activeClasses["rashbam"]=true;
					localStorage.setItem('actives',JSON.stringify(activeClasses));
				}
				
				keys=Object.keys(activeClasses);
					
					for (i = 0; i < keys.length; i += 1) {
						var key=keys[i];
						var appear=activeClasses[key];
						if (document.getElementById(key)!=null)
						{
						makeDisappearAppearDivsBasedOnClass(key,appear);
						if (appear)
						{
						document.getElementById(key).className=document.getElementById(key).className.replace("button", "button active");
						}
						else
						{
						document.getElementById(key).className=document.getElementById(key).className.replace("button active", "button");
						}
						
						
					}
					}

					makeDisappearAppearDivsBasedOnClass("theContent", true);
				
				
				
				
				}
				
			
					function hideShow(theClass, obj) {
						console.log(obj);
						if (obj.className=="button")
						{
						obj.className=obj.className.replace("button", "button active");
						console.log(activeClasses[theClass]);
						console.log(theClass);
						activeClasses[theClass]=true;
						console.log(activeClasses);
						localStorage.setItem('actives', JSON.stringify(activeClasses));
						
						}
						else
						{
						obj.className = obj.className.replace("button active", "button");
						console.log(activeClasses[theClass]);
						console.log(theClass);
						activeClasses[theClass]=false;
						console.log(activeClasses);
						localStorage.setItem('actives', JSON.stringify(activeClasses));
						}
						
						
						 var elements = document.getElementsByClassName(theClass), i;
							for (i = 0; i < elements.length; i += 1) {
							if (elements[i].style.display === 'none') {
								elements[i].style.display = 'inline-block';
							} else {
								elements[i].style.display = 'none';
							}
							}
						}
						
						function makeDisappearAppearDivsBasedOnClass(theClass,toAppear)
						{
						 var elements = document.getElementsByClassName(theClass), i;
							for (i = 0; i < elements.length; i += 1) {
							if (toAppear) {
								elements[i].style.display = 'inline-block';
							} else {
								elements[i].style.display = 'none';
							}
							}
						
						}