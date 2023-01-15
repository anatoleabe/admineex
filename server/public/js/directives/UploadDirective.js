angular.module('UploadDirective', []).directive('upload', function (gettextCatalog, $ocLazyLoad, $injector, $rootScope) {
    return {
        restrict: 'AE',
        scope: {
            status: '='
        },
        replace: true,
        templateUrl: 'templates/staffs/directives/upload.html',
        link: function ($scope, $element, $attrs, scope) {
            $scope.loadingChart = true;
            var button = $element.find('button');
            var input = angular.element($element[0].querySelector('input#fileInput'));
            button.bind('click', function () {
                input[0].click();
            });
            input.bind('change', function (e) {
                scope.$apply(function () {
                    var files = e.target.files;
                    if (files[0]) {
                        scope.fileName = files[0].name;
                    } else {
                        scope.fileName = null;
                    }
                });
            });
        }
    };
});
