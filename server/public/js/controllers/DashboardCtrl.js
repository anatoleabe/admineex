angular.module('DashboardCtrl', []).controller('DashboardController', function($scope, gettextCatalog, $ocLazyLoad,$state, $injector, $rootScope, $timeout) {
    $scope.helper = [];
    $scope.asks = [];
    var helper = {
        title: gettextCatalog.getString("Empty dashboard"),
        icon: "dashboard"
    };

    $ocLazyLoad.load('js/services/UIService.js').then(function() {
        var UI = $injector.get('UI');

        //Build charts
        function charts(){
            UI.charts().then(function(response) {
                var data = response.data;
                $rootScope.kernel.loading = 100;
                $scope.charts = data.charts;
                if ($scope.charts.length == 0) {
                    $scope.helper = helper;
                } else {
                    $scope.helper = [];
                }
            }).catch(function(response) {
                console.log(response);
            });
        };
                
        // Build the dashboard
        $scope.buildDashboard = function(){
            charts();
        }
        
        
        // First build
        $scope.buildDashboard();
    });
});