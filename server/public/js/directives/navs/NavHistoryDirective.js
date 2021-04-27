angular.module('NavHistoryDirective', []).directive('navhistory', function (gettextCatalog, $ocLazyLoad, $injector, $rootScope) {
    return {
        restrict: 'A',
        scope: {}, 
        templateUrl: 'templates/procrastinate/tasks/directives/navhistory.html',
        link: function ($scope, $element, $attrs) {
            $scope.loading = true;
            
            
        }
    };
});
