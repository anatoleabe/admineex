angular.module('DocumentService', []).factory('Document', function ($http) {
    return {
        list: function (info) {
            var limit = info.limit ? info.limit : 0;
            var skip = info.skip ? info.skip : 0;
            var search = info.search ? info.search : "-";
            var filters = info.filters ? info.filters : "-";
            return $http.get('/api/documents/' + limit + '/' + skip + '/' + search + '/' + filters);
        },
        read: function (info) {
            return $http.get('/api/documents/' + info.id);
        },
        upsert: function (info) {
            return $http.put('/api/documents', info);
        },
        update: function (info) {
            return $http.post('/api/documents', info);
        },
        delete: function (info) {
            return $http.delete('/api/documents/' + info.id);
        }
        
    }
});