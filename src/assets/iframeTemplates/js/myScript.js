

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
	document.getElementById("buttonNav").style.display = "none";
	}

			function closeNav() {
		document.getElementById("mySidenav").style.width = "0";
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
								malbim:true,
								ralbag:true,
								mezudatDavid:true,
								mezudatZion:true
								};
				localStorage.setItem('actives',JSON.stringify(activeClasses));
				}
				else
				{
				activeClasses=JSON.parse(activeClasses);
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
								elements[i].style.display = '';
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
								elements[i].style.display = '';
							} else {
								elements[i].style.display = 'none';
							}
							}
						
						}