angular.module('DictionaryService', []).factory('Dictionary', function($http) {
    return {
        jsonList: function(info) {
            var url = '/api/dictionary/'+info.dictionary+'/list?levels=';
            for(i=0;i<info.levels.length;i++){
                url += info.levels[i];
                if(i !== info.levels.length-1){
                    url += ',';
                }
            }
            if(info.language){
                url += '&language=' + info.language;
            }
            return $http.get(url);
        },
        jsonListProjects: function(info) {
            var url = '/api/dictionary/projects/'+info.dictionary+'/list?levels=';
            for(i=0;i<info.levels.length;i++){
                url += info.levels[i];
                if(i !== info.levels.length-1){
                    url += ',';
                }
            }
            if(info.language){
                url += '&language=' + info.language;
            }
            return $http.get(url);
        }

    };

});