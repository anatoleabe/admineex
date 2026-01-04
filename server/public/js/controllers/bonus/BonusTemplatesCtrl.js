angular.module('app')
    .controller('BonusTemplatesController', ['$scope', '$rootScope', '$http', '$q', '$timeout', '$ocLazyLoad', '$injector', 'toastr', function($scope, $rootScope, $http, $q, $timeout, $ocLazyLoad, $injector, toastr) {
        // Ensure kernel exists for this scope so views using kernel.loading work
        $scope.kernel = $scope.kernel || { loading: 100 };
        const role = ($rootScope.account && $rootScope.account.role) ? String($rootScope.account.role) : '';
        $scope.permissions = {
            canManageTemplates: role === '1'
        };
        // State management
        $scope.state = {
            loading: false,
            saving: false,
            deleting: false,
            viewing: false
        };

        $scope.templates = [];
        $scope.filteredTemplates = [];
        $scope.paginatedTemplates = [];
        $scope.editingTemplate = null;
        $scope.viewedTemplate = null;
        $scope.templateFormData = null;

        // Stats
        $scope.stats = { active: 0, inactive: 0 };

        // View and sorting
        $scope.viewMode = 'list';
        $scope.sortField = 'updatedAt';
        $scope.sortDir = 'desc';

        // Pagination
        $scope.pageSize = 10;
        $scope.currentPage = 1;
        $scope.pageCount = 1;

        // Filter variables
        $scope.searchQuery = '';
        $scope.statusFilter = '';
        // Deprecated single category filter kept for compatibility
        $scope.categoryFilter = '';
        // New multi-select category filters
        $scope.categoryFilters = [];

        // Constants for dropdown options
        $scope.constants = {
            categories: [
                { value: 'with_parts', label: 'With Parts' },
                { value: 'without_parts', label: 'Without Parts' },
                { value: 'fixed_amount', label: 'Fixed Amount' },
                { value: 'calculated', label: 'Calculated' }
            ],
            periodicities: [
                { value: 'daily', label: 'Daily' },
                { value: 'weekly', label: 'Weekly' },
                { value: 'monthly', label: 'Monthly' },
                { value: 'quarterly', label: 'Quarterly' },
                { value: 'semesterly', label: 'Semesterly' },
                { value: 'yearly', label: 'Yearly' },
                { value: 'on_demand', label: 'On Demand' }
            ],
            formulaTypes: [
                { value: 'fixed', label: 'Fixed Amount' },
                { value: 'percentage', label: 'Percentage Based' },
                { value: 'custom_formula', label: 'Custom Formula' },
                { value: 'parts_based', label: 'Parts Based' }
            ],
            operators: [
                { value: 'equals', label: 'Equals' },
                { value: 'not_equals', label: 'Not Equals' },
                { value: 'contains', label: 'Contains' },
                { value: 'greater_than', label: 'Greater Than' },
                { value: 'less_than', label: 'Less Than' },
                { value: 'in', label: 'In' },
                { value: 'not_in', label: 'Not In' }
            ],
            approvalTypes: [
                { value: 'sequential', label: 'Sequential' },
                { value: 'parallel', label: 'Parallel' }
            ],
            ruleFields: [
                { value: 'status', label: 'Statut' },
                { value: 'category', label: 'Catégorie' },
                { value: 'rank', label: 'Rang' },
                { value: 'structure', label: 'Structure' },
                { value: 'subStructure', label: 'Sous-structure' }
            ]
        };

        // Dropdown data for rule values
        $scope.ruleOptions = {
            statuses: [],
            ranks: [],
            structures: [],
            structuresMain: [],
            subStructures: []
        };
        const subStructuresByParent = {};
        $scope.iftStructureOptions = [];
        $scope.iftSelectedStructures = [];
        $scope.iftSelectedPersonnel = [];
        $scope.selectedIftStructureId = '';
        $scope.iftPersonnelSearch = '';
        let iftPersonnelSearchTimeout = null;

        function setStructureOptions(data) {
            $scope.ruleOptions.structures = [];
            $scope.ruleOptions.structuresMain = [];
            $scope.ruleOptions.subStructures = [];
            Object.keys(subStructuresByParent).forEach(k => delete subStructuresByParent[k]);
            const mains = [];
            const subs = [];
            const allStructureOptions = [];
            data.forEach(s => {
                const option = { value: s.code, label: `${s.name || s.code} (${s.code})`, rank: String(s.rank) };
                const name = s.name || s.fr || s.en || s.code;
                const optionWithId = {
                    id: s._id || s.id || s.code,
                    code: s.code,
                    label: `${name || s.code} (${s.code})`,
                    name: name
                };
                if (String(s.rank) === '2') {
                    mains.push(option);
                } else if (String(s.rank) === '3') {
                    subs.push(option);
                    const parentCode = s.code && s.code.includes('-') ? s.code.split('-')[0] : '';
                    if (!subStructuresByParent[parentCode]) subStructuresByParent[parentCode] = [];
                    subStructuresByParent[parentCode].push(option);
                }
                if (optionWithId.id) {
                    allStructureOptions.push(optionWithId);
                }
            });
            $scope.ruleOptions.structures = mains;
            $scope.ruleOptions.structuresMain = mains;
            $scope.ruleOptions.subStructures = subs;
            $scope.iftStructureOptions = allStructureOptions;
            hydrateIftSelectionsFromTemplate();
        }

        function loadStructures() {
            return $ocLazyLoad.load('js/services/StructureService.js')
                .then(() => {
                    const Structure = $injector.get('Structure');
                    return Structure.minimalList();
                })
                .catch(() => $http.get('/api/structures/minimal/-1'))
                .then(res => {
                    const data = (res.data && res.data.data) || res.data || [];
                    setStructureOptions(data);
                })
                .catch(() => {
                    $scope.ruleOptions.structures = [];
                    $scope.ruleOptions.structuresMain = [];
                    $scope.ruleOptions.subStructures = [];
                    $scope.iftStructureOptions = [];
                });
        }

        function loadRuleOptions() {
            // Statuses
            $http.get('/resources/dictionary/personnel/status.json').then(res => {
                const list = res.data || [];
                $scope.ruleOptions.statuses = list.map(item => ({
                    value: item.id,
                    label: item.en || item.fr || item.id
                }));
            }).catch(() => {
                $scope.ruleOptions.statuses = [];
            });

            // Ranks
            $http.get('/resources/dictionary/personnel/ranks.json').then(res => {
                const list = res.data || [];
                $scope.ruleOptions.ranks = list.map(item => ({
                    value: item.id,
                    label: item.fr || item.en || item.id
                }));
            }).catch(() => {
                $scope.ruleOptions.ranks = [];
            });

            // Structures (main + subs)
            loadStructures();
        }
        loadRuleOptions();

        // Initialize template form data
        function initializeTemplateForm() {
            $scope.templateFormData = {
                code: '',
                name: '',
                description: '',
                category: 'with_parts',
                periodicity: 'monthly',
                eligibilityRules: [],
                calculationConfig: {
                    formulaType: 'fixed',
                    baseField: '',
                    formula: '',
                    subType: 'remise',
                    defaultShareAmount: 0,
                    fixedAmount: 0,
                    percentage: 0,
                    rate: 0,
                    partsConfig: {
                        defaultParts: 1,
                        partRules: []
                    }
                },
                iftConfig: {
                    amountRules: [
                        { match: { rankCode: 'NON_NOMME' }, amount: 60000, description: 'Non nommé / CA / AG' },
                        { match: { rankCode: 'CA' }, amount: 60000, description: 'Cadre' },
                        { match: { rankCode: 'AG' }, amount: 60000, description: 'Agent' },
                        { match: { rankCode: 'CB' }, amount: 225000, description: 'Chef de bureau' },
                        { match: { rankCode: 'CS' }, amount: 270000, description: 'Chef de service' },
                        { match: { rankCode: 'SD' }, amount: 300000, description: 'Sous-Directeur' },
                        { match: { rankCode: 'DIR' }, amount: 300000, description: 'Directeur' }
                    ],
                    includedStructureIds: [],
                    includePersonnelIds: []
                },
                approvalWorkflow: {
                    steps: []
                },
                documentation: '',
                isActive: true
            };
            $scope.iftSelectedStructures = [];
            $scope.iftSelectedPersonnel = [];
            $scope.selectedIftStructureId = '';
            $scope.iftPersonnelSearch = '';
        }

        function computeStats() {
            const active = ($scope.templates || []).filter(t => !!t.isActive).length;
            const inactive = ($scope.templates || []).length - active;
            $scope.stats = { active, inactive };
        }

        // Apply filters to templates, then sort and paginate
        $scope.applyFilters = function(resetPage) {
            const list = $scope.templates || [];

            const query = ($scope.searchQuery || '').toLowerCase();
            const status = $scope.statusFilter; // '', 'true', 'false'
            const categorySet = new Set($scope.categoryFilters && $scope.categoryFilters.length ? $scope.categoryFilters : ($scope.categoryFilter ? [$scope.categoryFilter] : []));

            // Filter
            $scope.filteredTemplates = list.filter(template => {
                const matchesSearch = !query ||
                    (template.name && template.name.toLowerCase().includes(query)) ||
                    (template.code && template.code.toLowerCase().includes(query)) ||
                    (template.description && template.description.toLowerCase().includes(query));

                const matchesStatus = !status || (template.isActive + '' === status);

                const matchesCategory = categorySet.size === 0 || categorySet.has(template.category);

                return matchesSearch && matchesStatus && matchesCategory;
            });

            // Sort
            const field = $scope.sortField;
            const dir = $scope.sortDir === 'asc' ? 1 : -1;
            $scope.filteredTemplates.sort((a, b) => {
                let va = a[field];
                let vb = b[field];
                // Normalize values for comparison
                if (field === 'updatedAt') {
                    va = va ? new Date(va).getTime() : 0;
                    vb = vb ? new Date(vb).getTime() : 0;
                } else {
                    va = (va || '').toString().toLowerCase();
                    vb = (vb || '').toString().toLowerCase();
                }
                if (va < vb) return -1 * dir;
                if (va > vb) return 1 * dir;
                return 0;
            });

            // Pagination
            if (resetPage) $scope.currentPage = 1;
            $scope.pageCount = Math.max(1, Math.ceil($scope.filteredTemplates.length / $scope.pageSize));
            const start = ($scope.currentPage - 1) * $scope.pageSize;
            const end = start + Number($scope.pageSize);
            $scope.paginatedTemplates = $scope.filteredTemplates.slice(start, end);
        };

        $scope.setPage = function(page) {
            if (!page || page < 1 || page > $scope.pageCount) return;
            $scope.currentPage = page;
            $scope.applyFilters(false);
        };

        $scope.setStatusFilter = function(value) {
            $scope.statusFilter = value;
            $scope.applyFilters(true);
        };

        $scope.toggleCategory = function(value) {
            if (!$scope.categoryFilters) $scope.categoryFilters = [];
            const idx = $scope.categoryFilters.indexOf(value);
            if (idx === -1) $scope.categoryFilters.push(value);
            else $scope.categoryFilters.splice(idx, 1);
            $scope.applyFilters(true);
        };

        $scope.setViewMode = function(mode) {
            $scope.viewMode = mode;
        };

        $scope.toggleSortDir = function() {
            $scope.sortDir = $scope.sortDir === 'asc' ? 'desc' : 'asc';
            $scope.applyFilters(false);
        };

        // Reset all filters
        $scope.resetFilters = function() {
            $scope.searchQuery = '';
            $scope.statusFilter = '';
            $scope.categoryFilter = '';
            $scope.categoryFilters = [];
            $scope.currentPage = 1;
            $scope.applyFilters(true);
        };

        // Get label for category
        $scope.getCategoryLabel = function(category) {
            const found = $scope.constants.categories.find(c => c.value === category);
            return found ? found.label : category;
        };

        // Get label for periodicity
        $scope.getPeriodicityLabel = function(periodicity) {
            const found = $scope.constants.periodicities.find(p => p.value === periodicity);
            return found ? found.label : periodicity;
        };

        // Get label for formula type
        $scope.getFormulaTypeLabel = function(formulaType) {
            const found = $scope.constants.formulaTypes.find(f => f.value === formulaType);
            return found ? found.label : formulaType;
        };

        function normalizeEligibilityRules(rules) {
            return (rules || []).map(rule => {
                const valueInput = Array.isArray(rule.value)
                    ? rule.value.join(', ')
                    : (rule.value || rule.value === 0 ? rule.value : '');
                return {
                    field: rule.field || $scope.constants.ruleFields[0].value,
                    operator: rule.operator || 'equals',
                    value: rule.value,
                    valueInput: valueInput,
                    valueList: Array.isArray(rule.value) ? rule.value : [],
                    parentStructureCode: rule.parentStructureCode || '',
                    description: rule.description || ''
                };
            });
        }

        function parseList(valueInput) {
            if (valueInput === null || valueInput === undefined) return [];
            return String(valueInput)
                .split(',')
                .map(v => v.trim())
                .filter(Boolean);
        }

        function normalizeRuleForSave(rule) {
            if (!rule) return null;
            const isArrayOp = rule.operator === 'in' || rule.operator === 'not_in';
            const parsedValue = isArrayOp
                ? (rule.valueList && rule.valueList.length ? rule.valueList : parseList(rule.valueInput !== undefined ? rule.valueInput : rule.value))
                : (rule.valueInput !== undefined ? rule.valueInput : rule.value);
            return {
                field: rule.field,
                operator: rule.operator,
                value: parsedValue,
                parentStructureCode: rule.parentStructureCode || '',
                description: rule.description || ''
            };
        }

        $scope.getSubStructuresForRule = function(rule) {
            if (!rule) return $scope.ruleOptions.subStructures;
            const parent = rule.parentStructureCode || '';
            if (parent && subStructuresByParent[parent]) return subStructuresByParent[parent];
            return $scope.ruleOptions.subStructures;
        };

        function ensureIftConfig() {
            if (!$scope.templateFormData) return;
            $scope.templateFormData.iftConfig = $scope.templateFormData.iftConfig || { amountRules: [] };
            $scope.templateFormData.iftConfig.includedStructureIds = Array.isArray($scope.templateFormData.iftConfig.includedStructureIds)
                ? $scope.templateFormData.iftConfig.includedStructureIds
                : [];
            $scope.templateFormData.iftConfig.includePersonnelIds = Array.isArray($scope.templateFormData.iftConfig.includePersonnelIds)
                ? $scope.templateFormData.iftConfig.includePersonnelIds
                : [];
        }

        function formatPersonnelLabel(person) {
            if (!person) return '';
            const displayName = person.fname ||
                (person.name && person.name.given && person.name.given[0]) ||
                (person.name && person.name.text) ||
                person.name ||
                '';
            const identifier = person.identifier || person.matricule || '';
            return [displayName || 'Personnel', identifier].filter(Boolean).join(' • ');
        }

        function normalizePersonnelSelection(person, fallbackId) {
            const id = (person && (person._id || person.id)) || fallbackId;
            const label = formatPersonnelLabel(person) || (fallbackId || '');
            const name = (person && person.fname) ||
                (person && person.name && person.name.given && person.name.given[0]) ||
                (person && person.name && person.name.text) ||
                (person && person.name) ||
                label ||
                'Personnel';
            const identifier = (person && (person.identifier || person.matricule)) || '';
            return { id, label, name, identifier: identifier || id };
        }
        $scope.getIftPersonnelLabel = formatPersonnelLabel;

        function fetchPersonnelByIds(ids) {
            if (!ids || !ids.length) {
                $scope.iftSelectedPersonnel = [];
                return;
            }
            const promises = ids.map(id => $http.get('/api/personnel/read/' + id + '/true')
                .then(res => ({ id, person: res.data }))
                .catch(() => ({ id, person: null })));
            $q.all(promises).then(results => {
                const hydrated = [];
                results.forEach(({ id, person }) => {
                    if (hydrated.find(p => p.id === id)) return;
                    hydrated.push(normalizePersonnelSelection(person, id));
                });
                $scope.iftSelectedPersonnel = hydrated;
            });
        }

        function hydrateIftSelectionsFromTemplate() {
            if (!$scope.templateFormData || !$scope.templateFormData.iftConfig) return;
            ensureIftConfig();
            const cfg = $scope.templateFormData.iftConfig;
            const structureIds = Array.from(new Set(cfg.includedStructureIds || []));
            $scope.iftSelectedStructures = structureIds.map(id => {
                const found = ($scope.iftStructureOptions || []).find(opt => opt.id === id || opt.code === id);
                return found ? { id: found.id, label: found.label, code: found.code, name: found.label } : { id, label: id, code: id, name: id };
            });
            const personnelIds = Array.from(new Set(cfg.includePersonnelIds || []));
            if (personnelIds.length) {
                fetchPersonnelByIds(personnelIds);
            } else {
                $scope.iftSelectedPersonnel = [];
            }
        }

        function normalizeStructureId(val) {
            if (!val) return '';
            if (typeof val === 'object') {
                return val.id || val.code || val.value || '';
            }
            return val;
        }

        $scope.addIftStructure = function(optionOrId) {
            const id = normalizeStructureId(optionOrId || $scope.selectedIftStructureId);
            if (!id) return;
            ensureIftConfig();
            const cfg = $scope.templateFormData.iftConfig;
            if (!cfg.includedStructureIds.includes(id)) {
                cfg.includedStructureIds.push(id);
            }
            if (!$scope.iftSelectedStructures.some(s => s.id === id)) {
                const found = ($scope.iftStructureOptions || []).find(opt => opt.id === id || opt.code === id);
                $scope.iftSelectedStructures.push(found ? { id: found.id, label: found.label, code: found.code, name: found.label } : { id, label: id, code: id, name: id });
            }
            $scope.selectedIftStructureId = '';
        };

        $scope.removeIftStructure = function(id) {
            ensureIftConfig();
            const cfg = $scope.templateFormData.iftConfig;
            cfg.includedStructureIds = (cfg.includedStructureIds || []).filter(structId => structId !== id);
            $scope.iftSelectedStructures = ($scope.iftSelectedStructures || []).filter(s => s.id !== id);
        };

        $scope.searchIftPersonnel = function(query) {
            if (iftPersonnelSearchTimeout) {
                $timeout.cancel(iftPersonnelSearchTimeout);
                iftPersonnelSearchTimeout = null;
            }
            if (!query || !query.trim()) {
                return $q.when([]);
            }
            const deferred = $q.defer();
            iftPersonnelSearchTimeout = $timeout(() => {
                $http.get('/api/personnel/search/' + encodeURIComponent(query.trim()))
                    .then(response => deferred.resolve(response.data || []))
                    .catch(() => deferred.resolve([]));
            }, 350);
            return deferred.promise;
        };

        $scope.searchIftStructures = function(query) {
            const term = (query || '').toLowerCase().trim();
            const list = $scope.iftStructureOptions || [];
            if (!term) return $q.when(list.slice(0, 50));
            const filtered = list.filter(opt =>
                (opt.label && opt.label.toLowerCase().includes(term)) ||
                (opt.code && opt.code.toLowerCase().includes(term))
            );
            return $q.when(filtered.slice(0, 50));
        };

        $scope.onIftPersonnelSelected = function(person) {
            if (!person) return;
            ensureIftConfig();
            const cfg = $scope.templateFormData.iftConfig;
            const id = person._id || person.id;
            if (!id) return;
            if (!cfg.includePersonnelIds.includes(id)) {
                cfg.includePersonnelIds.push(id);
            }
            if (!$scope.iftSelectedPersonnel.some(p => p.id === id)) {
                $scope.iftSelectedPersonnel.push(normalizePersonnelSelection(person, id));
            }
            $scope.iftPersonnelSearch = '';
        };

        $scope.removeIftPersonnel = function(id) {
            ensureIftConfig();
            const cfg = $scope.templateFormData.iftConfig;
            cfg.includePersonnelIds = (cfg.includePersonnelIds || []).filter(pid => pid !== id);
            $scope.iftSelectedPersonnel = ($scope.iftSelectedPersonnel || []).filter(p => p.id !== id);
        };

        // View template details
        $scope.viewTemplate = function(template) {
            $scope.state.viewing = true;
            $scope.viewedTemplate = angular.copy(template);
            $('#modal_view_template').modal('show');
        };

        // Close view modal
        $scope.closeViewModal = function() {
            $('#modal_view_template').modal('hide');
            $scope.state.viewing = false;
            $scope.viewedTemplate = null;
        };

        // Deep clean object before saving (remove empty arrays/objects)
        function cleanTemplateData(data) {
            const cleaned = angular.copy(data);
            // Normalize IFT config defaults if missing
            if (cleaned.category === 'without_parts' && cleaned.calculationConfig && cleaned.calculationConfig.subType === 'ift') {
                cleaned.iftConfig = cleaned.iftConfig || {};
                if (!Array.isArray(cleaned.iftConfig.amountRules) || cleaned.iftConfig.amountRules.length === 0) {
                    cleaned.iftConfig.amountRules = [
                        { match: { rankCode: 'NON_NOMME' }, amount: 60000, description: 'Non nommé / CA / AG' },
                        { match: { rankCode: 'CA' }, amount: 60000, description: 'Cadre' },
                        { match: { rankCode: 'AG' }, amount: 60000, description: 'Agent' },
                        { match: { rankCode: 'CB' }, amount: 225000, description: 'Chef de bureau' },
                        { match: { rankCode: 'CS' }, amount: 270000, description: 'Chef de service' },
                        { match: { rankCode: 'SD' }, amount: 300000, description: 'Sous-Directeur' },
                        { match: { rankCode: 'DIR' }, amount: 300000, description: 'Directeur' }
                    ];
                }
            }

            if (cleaned.iftConfig) {
                if (Array.isArray(cleaned.iftConfig.includedStructureIds)) {
                    cleaned.iftConfig.includedStructureIds = Array.from(new Set(cleaned.iftConfig.includedStructureIds.filter(Boolean)));
                    if (cleaned.iftConfig.includedStructureIds.length === 0) delete cleaned.iftConfig.includedStructureIds;
                }
                if (Array.isArray(cleaned.iftConfig.includePersonnelIds)) {
                    cleaned.iftConfig.includePersonnelIds = Array.from(new Set(cleaned.iftConfig.includePersonnelIds.filter(Boolean)));
                    if (cleaned.iftConfig.includePersonnelIds.length === 0) delete cleaned.iftConfig.includePersonnelIds;
                }
            }

            // Clean eligibility rules
            if (cleaned.eligibilityRules) {
                cleaned.eligibilityRules = cleaned.eligibilityRules
                    .map(normalizeRuleForSave)
                    .filter(r => r && r.field && r.operator && r.value !== undefined && r.value !== null);
                if (cleaned.eligibilityRules.length === 0) {
                    delete cleaned.eligibilityRules;
                }
            }

            // Clean approval workflow
            if (cleaned.approvalWorkflow) {
                if (cleaned.approvalWorkflow.steps && cleaned.approvalWorkflow.steps.length === 0) {
                    delete cleaned.approvalWorkflow;
                }
            }

            // Clean calculation config
            if (cleaned.calculationConfig) {
                // Remove partsConfig if not with_parts
                if (cleaned.category !== 'with_parts' && cleaned.calculationConfig.partsConfig) {
                    delete cleaned.calculationConfig.partsConfig;
                }
                // Remove defaultShareAmount if not with_parts
                if (cleaned.category !== 'with_parts' && cleaned.calculationConfig.defaultShareAmount !== undefined) {
                    delete cleaned.calculationConfig.defaultShareAmount;
                }
                // Remove rate if not without_parts
                if (cleaned.category !== 'without_parts' && cleaned.calculationConfig.rate !== undefined) {
                    delete cleaned.calculationConfig.rate;
                }
                // For IFT subtype, drop rate and ensure subType set
                if (cleaned.category === 'without_parts' && cleaned.calculationConfig.subType === 'ift') {
                    delete cleaned.calculationConfig.rate;
                }
                // For non-calculated, drop formula settings except fixed amount as applicable
                if (cleaned.category !== 'calculated') {
                    delete cleaned.calculationConfig.formulaType;
                    delete cleaned.calculationConfig.formula;
                    delete cleaned.calculationConfig.baseField;
                    delete cleaned.calculationConfig.percentage;
                } else {
                    // In calculated, keep only the needed fields per formulaType
                    if (cleaned.calculationConfig.formulaType === 'fixed') {
                        delete cleaned.calculationConfig.baseField;
                        delete cleaned.calculationConfig.percentage;
                        delete cleaned.calculationConfig.formula;
                    } else if (cleaned.calculationConfig.formulaType === 'percentage') {
                        delete cleaned.calculationConfig.formula;
                    } else if (cleaned.calculationConfig.formulaType === 'custom_formula') {
                        delete cleaned.calculationConfig.baseField;
                        delete cleaned.calculationConfig.percentage;
                        delete cleaned.calculationConfig.fixedAmount;
                    }
                }
                // For fixed_amount category ensure unrelated fields are dropped
                if (cleaned.category === 'fixed_amount') {
                    delete cleaned.calculationConfig.rate;
                }
            }

            return cleaned;
        }

        // Validate template before saving
        function validateTemplate(template) {
            const errors = [];

            if (!template.code || !template.code.trim()) {
                errors.push('Template code is required');
            } else if (!/^[A-Z0-9_-]+$/.test(template.code)) {
                errors.push('Template code must contain only uppercase letters, numbers, underscores and dashes');
            }

            if (!template.name || !template.name.trim()) {
                errors.push('Template name is required');
            }

            if (!template.category) {
                errors.push('Category is required');
            }

            if (!template.periodicity) {
                errors.push('Periodicity is required');
            }

            // Category-specific validation
            const cfg = template.calculationConfig || {};
            switch (template.category) {
                case 'with_parts':
                    if (cfg.defaultShareAmount === null || cfg.defaultShareAmount === undefined || isNaN(cfg.defaultShareAmount)) {
                        errors.push('Default share amount is required for with-parts category');
                    } else if (Number(cfg.defaultShareAmount) < 0) {
                        errors.push('Default share amount cannot be negative');
                    }
                    if (cfg.partsConfig && cfg.partsConfig.defaultParts < 1) {
                        errors.push('Default parts must be at least 1');
                    }
                    break;
                case 'without_parts':
                    if (cfg.subType === 'ift') {
                        const rules = ($scope.templateFormData.iftConfig && $scope.templateFormData.iftConfig.amountRules) || [];
                        if (!rules.length) {
                            errors.push('IFT requires at least one amount rule');
                        }
                    } else {
                        if (cfg.rate === null || cfg.rate === undefined || isNaN(cfg.rate)) {
                            errors.push('Rate (TX) is required for without-parts category');
                        } else if (Number(cfg.rate) < 0) {
                            errors.push('Rate (TX) cannot be negative');
                        }
                    }
                    break;
                case 'fixed_amount':
                    if (cfg.fixedAmount === null || cfg.fixedAmount === undefined || isNaN(cfg.fixedAmount)) {
                        errors.push('Fixed amount is required for fixed amount category');
                    } else if (Number(cfg.fixedAmount) < 0) {
                        errors.push('Fixed amount cannot be negative');
                    }
                    break;
                case 'calculated':
                    if (!cfg.formulaType) {
                        errors.push('Formula type is required for calculated category');
                    } else if (cfg.formulaType === 'custom_formula') {
                        if (!cfg.formula || !cfg.formula.trim()) {
                            errors.push('Formula is required for custom formula type');
                        }
                    } else if (cfg.formulaType === 'percentage') {
                        if (!cfg.baseField || !cfg.baseField.trim()) {
                            errors.push('Base field is required for percentage formula type');
                        }
                        if (cfg.percentage === null || cfg.percentage === undefined || isNaN(cfg.percentage)) {
                            errors.push('Percentage is required for percentage formula type');
                        } else if (Number(cfg.percentage) < 0) {
                            errors.push('Percentage cannot be negative');
                        }
                    } else if (cfg.formulaType === 'fixed') {
                        if (cfg.fixedAmount === null || cfg.fixedAmount === undefined || isNaN(cfg.fixedAmount)) {
                            errors.push('Fixed amount is required for fixed formula type');
                        } else if (Number(cfg.fixedAmount) < 0) {
                            errors.push('Fixed amount cannot be negative');
                        }
                    }
                    break;
            }

            // Validate eligibility rules if they exist
            if (template.eligibilityRules) {
                template.eligibilityRules.forEach((rule, index) => {
                    if (!rule.field || !rule.field.trim()) {
                        errors.push(`Eligibility rule ${index + 1}: Field is required`);
                    }
                    if (!rule.operator) {
                        errors.push(`Eligibility rule ${index + 1}: Operator is required`);
                    }

                    // Derive effective value same way we save it (handles valueList/valueInput)
                    const normalized = normalizeRuleForSave(rule);
                    const val = normalized ? normalized.value : undefined;
                    const isArrayVal = Array.isArray(val);
                    const isEmptyArray = isArrayVal && val.length === 0;
                    const isEmptyString = typeof val === 'string' && !val.trim();
                    if (val === undefined || val === null || isEmptyArray || isEmptyString) {
                        errors.push(`Eligibility rule ${index + 1}: Value is required`);
                    } else {
                        // Keep the normalized value in sync so server validation matches UI
                        rule.value = val;
                    }
                });
            }

            // Validate approval workflow if it exists
            if (template.approvalWorkflow && template.approvalWorkflow.steps) {
                template.approvalWorkflow.steps.forEach((step, index) => {
                    if (!step.role || !step.role.trim()) {
                        errors.push(`Approval step ${index + 1}: Role is required`);
                    }
                    if (!step.approvalType) {
                        errors.push(`Approval step ${index + 1}: Approval type is required`);
                    }
                });
            }

            return errors.length ? errors : null;
        }

        // Load all templates
        function loadTemplates() {
            $scope.state.loading = true;
            $scope.kernel.loading = 0;
            return $http.get('/api/bonus/templates', { params: { limit: 500, offset: 0, envelope: true } })
                .then(function(response) {
                    var data = response.data;
                    $scope.templates = (data && data.items) ? data.items : (Array.isArray(data) ? data : []);
                    computeStats();
                    $scope.applyFilters(true);
                })
                .catch(function(err) {
                    toastr.error('Failed to load bonus programs');
                    console.error('Error loading bonus templates:', err);
                })
                .finally(function() {
                    $scope.state.loading = false;
                    $scope.kernel.loading = 100;
                });
        }

        // Toggle active status
        $scope.toggleActive = function(template) {
            if (!$scope.permissions.canManageTemplates) {
                toastr.error('Not authorized');
                template.isActive = !template.isActive;
                return;
            }
            const updated = { isActive: !!template.isActive };
            $scope.state.saving = true;
            $http.put('/api/bonus/templates/' + template._id, updated)
                .then(function(res) {
                    // Update updatedAt from server if returned
                    if (res && res.data) {
                        template.updatedAt = res.data.updatedAt || template.updatedAt;
                        template.isActive = res.data.isActive !== undefined ? res.data.isActive : template.isActive;
                    }
                    computeStats();
                    toastr.success('Template ' + (template.isActive ? 'activated' : 'deactivated'), 'Success');
                })
                .catch(function(err) {
                    console.error('Error updating status:', err);
                    toastr.error('Failed to update status', 'Error');
                    // Revert toggle on error
                    template.isActive = !template.isActive;
                })
                .finally(function() {
                    $scope.state.saving = false;
                });
        };

        // Initial load
        loadTemplates();

        // Helper function for category descriptions
        $scope.getCategoryHelp = function(category) {
            const cat = $scope.constants.categories.find(c => c.value === category);
            if (!cat) return 'Select a category';

            switch(category) {
                case 'with_parts': return 'Bonus calculated using a configurable parts system';
                case 'without_parts': return 'Simple bonus without parts calculation';
                case 'fixed_amount': return 'Fixed amount bonus for all eligible personnel';
                case 'calculated': return 'Custom calculated bonus using formulas';
                default: return cat.label;
            }
        };

        // Open create form
        $scope.openTemplateForm = function() {
            if (!$scope.permissions.canManageTemplates) {
                toastr.error('Not authorized');
                return;
            }
            $scope.editingTemplate = null;
            initializeTemplateForm();
            $('#modal_basic').modal('show');
            $('a[href="#basic-info"]').tab('show');
        };

        // Edit template
        $scope.editTemplate = function(template) {
            if (!$scope.permissions.canManageTemplates) {
                toastr.error('Not authorized');
                return;
            }
            $scope.editingTemplate = template;
            $scope.templateFormData = angular.copy(template);
            $scope.selectedIftStructureId = '';
            $scope.iftPersonnelSearch = '';

            // Ensure nested objects exist
            $scope.templateFormData.calculationConfig = $scope.templateFormData.calculationConfig || {};
            if (!$scope.templateFormData.calculationConfig.subType && $scope.templateFormData.category === 'without_parts') {
                $scope.templateFormData.calculationConfig.subType = 'remise';
            }
            $scope.templateFormData.calculationConfig.partsConfig = $scope.templateFormData.calculationConfig.partsConfig || {
                defaultParts: 1,
                partRules: []
            };
            $scope.templateFormData.iftConfig = $scope.templateFormData.iftConfig || { amountRules: [] };
            ensureIftConfig();
            hydrateIftSelectionsFromTemplate();
            $scope.templateFormData.approvalWorkflow = $scope.templateFormData.approvalWorkflow || { steps: [] };
            $scope.templateFormData.eligibilityRules = normalizeEligibilityRules($scope.templateFormData.eligibilityRules || []);

            $('#modal_basic').modal('show');
            $('a[href="#basic-info"]').tab('show');
        };

        // Close form modal
        $scope.closeTemplateForm = function() {
            $('#modal_basic').modal('hide');
            $scope.editingTemplate = null;
            $scope.templateFormData = null;
        };

        // Helper functions for eligibility rules
        $scope.addEligibilityRule = function() {
            if (!$scope.templateFormData.eligibilityRules) {
                $scope.templateFormData.eligibilityRules = [];
            }
            $scope.templateFormData.eligibilityRules.push({
                field: $scope.constants.ruleFields[0].value,
                operator: 'equals',
                valueInput: '',
                valueList: [],
                value: '',
                parentStructureCode: '',
                description: ''
            });
        };

        $scope.removeEligibilityRule = function(index) {
            $scope.templateFormData.eligibilityRules.splice(index, 1);
        };

        $scope.moveEligibilityRule = function(index, direction) {
            if (direction === 'up' && index > 0) {
                const temp = $scope.templateFormData.eligibilityRules[index - 1];
                $scope.templateFormData.eligibilityRules[index - 1] = $scope.templateFormData.eligibilityRules[index];
                $scope.templateFormData.eligibilityRules[index] = temp;
            } else if (direction === 'down' && index < $scope.templateFormData.eligibilityRules.length - 1) {
                const temp = $scope.templateFormData.eligibilityRules[index + 1];
                $scope.templateFormData.eligibilityRules[index + 1] = $scope.templateFormData.eligibilityRules[index];
                $scope.templateFormData.eligibilityRules[index] = temp;
            }
        };

        // Helper functions for approval workflow
        $scope.addApprovalStep = function() {
            if (!$scope.templateFormData.approvalWorkflow) {
                $scope.templateFormData.approvalWorkflow = { steps: [] };
            }
            if (!$scope.templateFormData.approvalWorkflow.steps) {
                $scope.templateFormData.approvalWorkflow.steps = [];
            }
            $scope.templateFormData.approvalWorkflow.steps.push({
                role: '',
                approvalType: 'sequential',
                description: ''
            });
        };

        // IFT helpers
        $scope.addIftRule = function() {
            $scope.templateFormData.iftConfig = $scope.templateFormData.iftConfig || { amountRules: [] };
            $scope.templateFormData.iftConfig.amountRules.push({
                match: { rankCode: '' },
                amount: 0,
                description: ''
            });
        };

        $scope.removeIftRule = function(index) {
            if (!$scope.templateFormData.iftConfig || !$scope.templateFormData.iftConfig.amountRules) return;
            $scope.templateFormData.iftConfig.amountRules.splice(index, 1);
        };

        $scope.resetIftDefaultRules = function() {
            ensureIftConfig();
            $scope.templateFormData.iftConfig.amountRules = [
                { match: { rankCode: 'NON_NOMME' }, amount: 60000, description: 'Non nommé / CA / AG' },
                { match: { rankCode: 'CA' }, amount: 60000, description: 'Cadre' },
                { match: { rankCode: 'AG' }, amount: 60000, description: 'Agent' },
                { match: { rankCode: 'CB' }, amount: 225000, description: 'Chef de bureau' },
                { match: { rankCode: 'CS' }, amount: 270000, description: 'Chef de service' },
                { match: { rankCode: 'SD' }, amount: 300000, description: 'Sous-Directeur' },
                { match: { rankCode: 'DIR' }, amount: 300000, description: 'Directeur' }
            ];
        };

        $scope.removeApprovalStep = function(index) {
            $scope.templateFormData.approvalWorkflow.steps.splice(index, 1);
        };

        $scope.moveApprovalStep = function(index, direction) {
            if (!$scope.templateFormData.approvalWorkflow.steps) return;

            if (direction === 'up' && index > 0) {
                const temp = $scope.templateFormData.approvalWorkflow.steps[index - 1];
                $scope.templateFormData.approvalWorkflow.steps[index - 1] = $scope.templateFormData.approvalWorkflow.steps[index];
                $scope.templateFormData.approvalWorkflow.steps[index] = temp;
            } else if (direction === 'down' && index < $scope.templateFormData.approvalWorkflow.steps.length - 1) {
                const temp = $scope.templateFormData.approvalWorkflow.steps[index + 1];
                $scope.templateFormData.approvalWorkflow.steps[index + 1] = $scope.templateFormData.approvalWorkflow.steps[index];
                $scope.templateFormData.approvalWorkflow.steps[index] = temp;
            }
        };

        // Normalize template code: uppercase, replace whitespace with underscores, keep allowed chars
        $scope.onCodeChange = function() {
            var v = ($scope.templateFormData && $scope.templateFormData.code) ? String($scope.templateFormData.code) : '';
            // Replace any whitespace with underscore
            v = v.replace(/\s+/g, '_');
            // Uppercase
            v = v.toUpperCase();
            // Strip invalid characters to underscores
            v = v.replace(/[^A-Z0-9_-]/g, '_');
            if ($scope.templateFormData) $scope.templateFormData.code = v;
        };

        // Save template
        $scope.saveTemplate = function() {
            if (!$scope.permissions.canManageTemplates) {
                toastr.error('Not authorized');
                return;
            }
            const validationErrors = validateTemplate($scope.templateFormData);
            if (validationErrors) {
                validationErrors.forEach(error => toastr.warning(error, 'Validation Error'));
                return;
            }

            $scope.state.saving = true;

            const cleanedData = cleanTemplateData($scope.templateFormData);
            const method = $scope.editingTemplate ? 'put' : 'post';
            const url = '/api/bonus/templates' + ($scope.editingTemplate ? '/' + $scope.editingTemplate._id : '');

            $http[method](url, cleanedData)
                .then(function() {
                    toastr.success('Template saved successfully', 'Success');
                    loadTemplates();
                    $scope.closeTemplateForm();
                })
                .catch(function(error) {
                    console.error('Error saving template:', error);
                    const errorMsg = error.data && error.data.message ? error.data.message : 'Error saving template';
                    toastr.error(errorMsg, 'Error');
                })
                .finally(function() {
                    $scope.state.saving = false;
                });
        };

        // Delete template
        $scope.confirmDelete = function(template) {
            if (!$scope.permissions.canManageTemplates) {
                toastr.error('Not authorized');
                return;
            }
            if (!confirm('Are you sure you want to delete this template? This action cannot be undone.')) {
                return;
            }

            $scope.state.deleting = true;

            $http.delete('/api/bonus/templates/' + template._id)
                .then(function() {
                    toastr.success('Template deleted successfully', 'Success');
                    loadTemplates();
                })
                .catch(function(error) {
                    console.error('Error deleting template:', error);
                    const errorMsg = error.data && error.data.message ? error.data.message : 'Error deleting template';
                    toastr.error(errorMsg, 'Error');
                })
                .finally(function() {
                    $scope.state.deleting = false;
                });
        };
    }]);
