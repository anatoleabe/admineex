angular.module('SynthesisCtrl', []).controller('SynthesisController', function($scope, gettextCatalog, $ocLazyLoad,$state, $injector, $rootScope, $timeout) {
    $scope.helper = [];
    $scope.asks = [];
    var helper = {
        title: gettextCatalog.getString("Empty synthesis"),
        icon: "synthesis"
    };

    $ocLazyLoad.load('js/services/UIService.js').then(function() {
        $rootScope.kernel.loading = 100;
    });
});