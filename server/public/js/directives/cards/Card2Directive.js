angular.module('Card2Directive', []).directive('card2', function (gettextCatalog, $ocLazyLoad, $injector, $rootScope) {
    return {
        restrict: 'A',
        scope: {}, 
        templateUrl: 'templates/statistics/directives/card2.html',
        link: function ($scope, $element, $attrs) {
            $scope.loadingChart = true;
            
            $ocLazyLoad.load('js/services/ChartService.js').then(function () {
                var Chart = $injector.get('Chart');
                function build() {
                    $scope.loadingChart = true;
                    Chart.build({
                        name : 'tresor'
                    }).then(function (response) {
                        $scope.loadingChart = false;
                        $scope.data = [
                            response.data.ipt, 
                            response.data.ip, 
                            response.data.cpt, 
                            response.data.ct, 
                            response.data.cat, 
                            response.data.commis
                        ];
                    }).catch(function (response) {
                        console.log(response);
                        $rootScope.kernel.alerts.push({
                            type: 1,
                            msg: gettextCatalog.getString('An error occurred, please try again later'),
                            priority: 2
                        });
                    });
                }
                $scope.$root.$watch('selectedStructure', function (newval, oldval) {
                    if (newval) {
                        console.log(gettextCatalog.getString('Welcome to Sygipet 2'));
                        //console.log("Changement card 2");
                    }
                });
                build();
            });
        }
    };
});
