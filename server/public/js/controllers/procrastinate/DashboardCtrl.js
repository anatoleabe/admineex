angular.module('DashboardCtrl', []).controller('DashboardController', function($scope, gettextCatalog, $ocLazyLoad,$state, $injector, $rootScope, $timeout) {
    $scope.helper = [];
    $scope.asks = [];
    var helper = {
        title: gettextCatalog.getString("Empty dashboard"),
        icon: "dashboard"
    };

    $ocLazyLoad.load('js/services/UIService.js').then(function() {
        $rootScope.kernel.loading = 100;
    });
});