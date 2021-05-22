angular.module('NavCommentsDirective', []).directive('navcomments', function (gettextCatalog, $ocLazyLoad, $injector, $rootScope) {
    return {
        restrict: 'A',
        scope: {}, 
        templateUrl: 'templates/procrastinate/tasks/directives/navcomments.html',
        link: function ($scope, $element, $attrs) {
            $scope.loading = true;
            
            
            //console.log("mama nav comment")
        }
    };
});
