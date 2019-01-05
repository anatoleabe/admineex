angular.module('InvoiceService', []).factory('Invoice', function($http) {
    return {
        list: function() {
            console.log("Service Get");
            return $http.get('/api/invoices');
        },
        read: function(info) {
            return $http.get('/api/invoices/' + info.id);
        },
        create: function(info) {
            return $http.post('/api/invoices', info);
        },
        update: function(info) {
            return $http.put('/api/invoices/' + info._id, info);
        },
        delete: function(info) {
            return $http.delete('/api/invoices/' + info.id);
        }
    }
});