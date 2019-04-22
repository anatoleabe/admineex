angular.module('StaffManagementCtrl', [[
    'node_modules/angular-material-data-table/dist/md-data-table.min.css'
]]).controller('StaffManagementController', ['$scope', 'gettextCatalog', '$location', '$ocLazyLoad', '$injector', function($scope, gettextCatalog, $location, $ocLazyLoad, $injector) {
    $ocLazyLoad.load('js/services/UIService.js').then(function() {
        var UI = $injector.get('UI');
        
        UI.nav().then(function(response) {
            var data = response.data;
            $scope.tabs = [];
            for(var i=0; i< data.nav.left[0].items.length; i++){
                if(data.nav.left[0].items[i].name === "Staff management"){
                    for(var j=0; j< data.nav.left[0].items[i].items.length; j++){
                        data.nav.left[0].items[i].items[j].name = gettextCatalog.getString(data.nav.left[0].items[i].items[j].name);
                    }
                    $scope.tabs = data.nav.left[0].items[i].items;
                }
            }
            console.log($scope.tabs)
        }).catch(function(response) {
            console.error(response);
        });
    });
    $scope.currentTab = 0;
    if($location.path().indexOf('/staffs/staffmanagement') > -1){
        $scope.currentTab = 1;
    } else if($location.path().indexOf('/staffs/movement') > -1){
        $scope.currentTab = 2;
    } else if($location.path().indexOf('/staffs/status') > -1){
        $scope.currentTab = 3;
    } else if($location.path().indexOf('/staffs/discipline') > -1){
        $scope.currentTab = 4;
    }

    $scope.label = {
        page: gettextCatalog.getString("Page")  + gettextCatalog.getString(":"),
        rowsPerPage: gettextCatalog.getString("Rows per page") + gettextCatalog.getString(":"),
        of: gettextCatalog.getString("of")
    }
}]);