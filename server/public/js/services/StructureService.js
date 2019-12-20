angular.module('StructureService', []).factory('Structure', function($http) {
    return {
        list: function() {
            return $http.get('/api/structures');
        },
        minimalList: function(info) {
            if (info){
                return $http.get('/api/structures/minimal/'+info.id);
            }else{
                return $http.get('/api/structures/minimal/-1');
            }
        },
        read: function(info) {
            return $http.get('/api/structures/read/' + info.id);
        },
        upsert: function(info) {
            return $http.put('/api/structures', info);
        },
        delete: function(info) {
            return $http.delete('/api/structures/' + info.id);
        }
    }
});