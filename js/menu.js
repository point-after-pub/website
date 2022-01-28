$(function(){

    window.changeMenu = function(isFriday){
        setMenu(isFriday);
    };

    var exists = function(value){
        return value != undefined && value != null && value != '';
    };

    var $layout;
    var $regularMenu = $('#menuLayout');
    var $fridayMenu = $('#fridayMenuLayout');
    var $curbSideMenu = $('#curbSideMenuLayout');

    var groupTemplate = Handlebars.compile($('#groupTemplate').html());
    var groupItemTemplate = Handlebars.compile($('#groupItemTemplate').html());
    var groupItemInlineTemplate = Handlebars.compile($('#groupItemInlineTemplate').html());
    var group2ColTemplate = Handlebars.compile($('#group2ColTemplate').html());
    var group3ColTemplate = Handlebars.compile($('#group3ColTemplate').html());

    Handlebars.registerPartial("groupItem", groupItemTemplate);

    Handlebars.registerHelper('resolve_price', function() {
        return exists(this.price)
            ? new Handlebars.SafeString(this.price.toFixed(2))
            : '';
    });

    var success = function(data){
        if(!data && data.length <= 0){
            return;
        }

        for(var i=0; i<data.length; i++){
            var group = data[i];
            var $group = $layout.find('.group-' + (i+1));

            if($group.length > 0){

                var html = groupTemplate(group);

                if(group.items && group.items.length > 0){
                    if(group.layout && group.layout == '3col'){

                        var cols3 = {
                            left: [],
                            middle: [],
                            right: []
                        };

                        for(var z=0; z<group.items.length; z++){
                            if(z % 3 == 0){
                                cols3.left.push(group.items[z]);
                            }
                            else if(z % 3 == 1){
                                cols3.middle.push(group.items[z]);
                            }
                            else {
                                cols3.right.push(group.items[z]);
                            }
                        }

                        html += group3ColTemplate(cols3);
                    }
                    else if(group.layout && group.layout == '2col'){

                        var cols2 = {
                            left: [],
                            right: []
                        };

                        for(var r=0; r<group.items.length; r++){
                            if(r % 2 == 0){
                                cols2.left.push(group.items[r]);
                            }
                            else {
                                cols2.right.push(group.items[r]);
                            }
                        }

                        html += group2ColTemplate(cols2);
                    }
                    else{
                        for(var j=0; j<group.items.length; j++){
                            html += groupItemTemplate(group.items[j]);
                        }
                    }
                }

                if(group.itemsInline && group.itemsInline.length > 0){
                    for(var k=0; k<group.itemsInline.length; k++){
                        html += groupItemInlineTemplate(group.itemsInline[k]);
                    }
                }
            }

            $group.html(html);
        }
    };

    var setMenu = function(isFriday){
        var menuUrl = 'menu/curb-side-menu.json';
        $layout = $curbSideMenu;

        if(isFriday){
            menuUrl = 'menu/friday-menu.json';
            $layout = $fridayMenu;
            $curbSideMenu.addClass('hidden');
            $fridayMenu.removeClass('hidden');
        }
        else{
            $layout = $curbSideMenu;
            $fridayMenu.addClass('hidden');
            $curbSideMenu.removeClass('hidden');
        }

        $.ajax({
            dataType: "json",
            url: menuUrl,
            cache: false,
            success: success,
            error: function (jqXHR, textStatus, errorThrown){
                console.log(errorThrown)
            }
        });
    };

    setMenu(new Date().getDay() === 5);
});