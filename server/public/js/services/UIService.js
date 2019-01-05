angular.module('UIService', []).factory('UI', function($http) {
    return {
        nav: function(){
            return $http.get("/api/ui/nav");
        },
        
        charts: function(){
            return $http.get("/api/ui/charts");
        },
        
        settings: function(){
            return $http.get("/api/ui/settings");
        },
        
        toggleCard: function(info){
            return $http.post("/api/ui/cards/toggle", info);
        },
        
        app: function(info){
            return $http.get("/api/ui/app/"+info.name);
        }
    }
});