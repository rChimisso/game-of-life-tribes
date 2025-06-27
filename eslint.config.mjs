import { defineConfig, globalIgnores } from "eslint/config";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import angularEslint from "@angular-eslint/eslint-plugin";
import unusedImports from "eslint-plugin-unused-imports";
import sonarjs from "eslint-plugin-sonarjs";
import _import from "eslint-plugin-import";
import jsdoc from "eslint-plugin-jsdoc";
import { fixupPluginRules } from "@eslint/compat";
import tsParser from "@typescript-eslint/parser";
import angularEslintTemplate from "@angular-eslint/eslint-plugin-template";
import parser from "@angular-eslint/template-parser";
import stylistic from '@stylistic/eslint-plugin'

export default defineConfig([globalIgnores(["docs/**/*", "node_modules/**/*"]), {
    settings: {
        jsdoc: {
            tagNamePreference: {
                access: false,
                export: "export",
                augments: "extends",
                "tag constructor": "constructor",

                todo: {
                    message: "Implement todo related task.",
                },
            },

            implementsReplacesDocs: false,
            augmentsExtendsReplacesDocs: false,

            preferredTypes: {
                any: {
                    message: "Prefer the use of '*' over 'any'.",
                    replacement: "*",
                },

                "Array<>": {
                    message: "Prefer the use of '[]' over 'Array<>'.",
                    replacement: "[]",
                },

                structuredTags: {
                    param: "type",
                },
            },
        },

        "import/extensions": [".js", ".ts", ".json"],
    },
}, {
    files: ["**/*.ts"],

    plugins: {
        "@typescript-eslint": typescriptEslint,
        "@angular-eslint": angularEslint,
        "unused-imports": unusedImports,
        "@stylistic": stylistic,
        sonarjs,
        import: fixupPluginRules(_import),
        jsdoc,
    },

    languageOptions: {
        parser: tsParser,
        ecmaVersion: 5,
        sourceType: "script",

        parserOptions: {
            project: ["./tsconfig.json"],
        },
    },

    rules: {
        "no-whitespace-before-property": "warn",
        "lines-between-class-members": "warn",
        "computed-property-spacing": "warn",
        "object-property-newline": "warn",
        "no-useless-computed-key": "warn",
        "generator-star-spacing": "warn",
        "switch-colon-spacing": "warn",
        "capitalized-comments": "warn",
        "no-array-constructor": "warn",
        "operator-assignment": "warn",
        "space-before-blocks": "warn",
        "arrow-body-style": "warn",
        "object-shorthand": "warn",
        "no-useless-catch": "warn",
        "keyword-spacing": "warn",
        "space-unary-ops": "warn",
        "no-multi-spaces": "warn",
        "prefer-template": "warn",
        "space-in-parens": "warn",
        "spaced-comment": "warn",
        "no-spaced-func": "warn",
        "no-else-return": "warn",
        "no-fallthrough": "warn",
        "comma-spacing": "warn",
        "block-spacing": "warn",
        "arrow-spacing": "warn",
        "prefer-const": "warn",
        "no-lonely-if": "warn",
        "guard-for-in": "warn",
        "key-spacing": "warn",
        "comma-style": "warn",
        "no-debugger": "warn",
        "no-empty": "warn",
        "eol-last": "warn",
        "function-call-argument-newline": ["warn", "consistent"],
        "space-before-function-paren": ["warn", "never"],

        "no-multiple-empty-lines": ["warn", {
            max: 1,
            maxBOF: 0,
            maxEOF: 0,
        }],

        "max-lines-per-function": ["warn", 200],
        "function-paren-newline": ["warn", "multiline-arguments"],
        "array-bracket-spacing": ["warn", "never"],

        "array-bracket-newline": ["warn", {
            multiline: true,
            minItems: 4,
        }],

        "array-element-newline": ["warn", {
            multiline: true,
            minItems: 4,
        }],

        "object-curly-spacing": ["warn", "never", {
            objectsInObjects: true,
            arraysInObjects: false,
        }],

        "object-curly-newline": ["warn", {
            ObjectExpression: {
                consistent: true,
                minProperties: 3,
            },

            ObjectPattern: {
                consistent: false,
                minProperties: 15,
            },

            ImportDeclaration: "never",
            ExportDeclaration: "never",
        }],

        "prefer-destructuring": ["warn", {
            VariableDeclarator: {
                array: false,
                object: true,
            },

            AssignmentExpression: {
                array: false,
                object: false,
            },
        }, {
            enforceForRenamedProperties: false,
        }],

        "no-warning-comments": ["warn", {
            terms: ["FIXME", "TODO"],
        }],

        "operator-linebreak": ["warn", "after"],

        "no-trailing-spaces": ["warn", {
            ignoreComments: true,
        }],

        "no-empty-function": ["warn", {
            allow: ["arrowFunctions", "constructors"],
        }],

        "padded-blocks": ["warn", "never"],
        "arrow-parens": ["warn", "as-needed"],

        "semi-spacing": ["warn", {
            before: false,
            after: true,
        }],

        "comma-dangle": ["warn", "never"],
        "max-params": ["warn", 7],
        complexity: ["warn", 10],

        "max-lines": ["warn", {
            max: 430,
            skipBlankLines: true,
            skipComments: true,
        }],

        "max-len": ["warn", {
            ignorePattern: "^import .*",
            code: 255,
            comments: 255,
            tabWidth: 2,
        }],

        indent: ["warn", 2, {
            SwitchCase: 1,
            ignoredNodes: ["VariableDeclaration[declarations.length=0]"],
        }],

        quotes: ["warn", "single"],

        "max-statements-per-line": ["error", {
            max: 2,
        }],

        "no-restricted-imports": ["error", {
            paths: ["rxjs/Rx"],
        }],

        "max-nested-callbacks": "off",

        "no-labels": ["error", {
            allowLoop: true,
            allowSwitch: true,
        }],

        "max-depth": ["error", 3],
        radix: ["error", "always"],
        curly: ["error", "all"],
        "no-template-curly-in-string": "error",
        "no-shadow-restricted-names": "error",
        "no-unexpected-multiline": "error",
        "array-callback-return": "error",
        "prefer-object-has-own": "error",
        "no-this-before-super": "error",
        "prefer-rest-params": "error",
        "no-unsafe-negation": "error",
        "no-useless-return": "error",
        "no-param-reassign": "error",
        "consistent-return": "error",
        "no-nested-ternary": "error",
        "no-unsafe-finally": "error",
        "default-case-last": "error",
        "no-import-assign": "error",
        "no-sparse-arrays": "error",
        "no-empty-pattern": "error",
        "no-return-assign": "error",
        "no-implied-eval": "error",
        "no-dupe-else-if": "error",
        "no-self-compare": "error",
        "no-return-await": "error",
        "no-new-wrappers": "error",
        "no-unreachable": "error",
        "no-cond-assign": "error",
        "no-self-assign": "error",
        "no-new-require": "error",
        "no-delete-var": "error",
        "no-extra-semi": "error",
        "no-undef-init": "error",
        "for-direction": "error",
        "require-yield": "error",
        "no-new-object": "error",
        "no-new-symbol": "error",
        "no-redeclare": "error",
        "no-loop-func": "error",
        "no-sequences": "error",
        "no-multi-str": "error",
        "no-new-func": "error",
        "use-isnan": "error",
        "no-caller": "error",
        "no-alert": "error",
        "no-octal": "error",
        "no-eval": "error",
        "no-void": "error",
        "no-new": "error",
        "no-var": "error",
        "eqeqeq": "error",
        "@typescript-eslint/consistent-indexed-object-style": "warn",
        "@typescript-eslint/no-unnecessary-type-constraint": "warn",
        "@typescript-eslint/no-unnecessary-type-arguments": "warn",
        "@typescript-eslint/no-unnecessary-type-assertion": "warn",
        "@typescript-eslint/adjacent-overload-signatures": "warn",
        "@stylistic/function-call-spacing": "warn",
        "@stylistic/space-infix-ops": "warn",
        "@typescript-eslint/no-explicit-any": "warn",
        "@typescript-eslint/prefer-readonly": "warn",
        "@typescript-eslint/prefer-includes": "warn",
        "@typescript-eslint/prefer-for-of": "warn",
        "@stylistic/brace-style": "warn",
        "@typescript-eslint/array-type": "warn",
        "@typescript-eslint/no-shadow": "warn",

        "@typescript-eslint/explicit-member-accessibility": ["warn", {
            accessibility: "explicit",
        }],

        "@typescript-eslint/consistent-type-definitions": "warn",

        "@typescript-eslint/no-inferrable-types": ["warn", {
            ignoreParameters: true,
        }],

        "@stylistic/no-extra-parens": ["warn", "all", {
            conditionalAssign: false,
            returnAssign: false,
            nestedBinaryExpressions: false,
        }],

        "@typescript-eslint/no-unused-vars": ["warn", {
            vars: "all",
            varsIgnorePattern: "^_",
            argsIgnorePattern: "^_",
        }],

        "@typescript-eslint/dot-notation": ["warn", {
            allowPrivateClassPropertyAccess: true,
            allowProtectedClassPropertyAccess: true,
            allowIndexSignaturePropertyAccess: true,
        }],

        "@typescript-eslint/naming-convention": ["warn", {
            selector: ["variable", "function", "parameter", "property", "method"],
            format: ["camelCase"],
        }, {
            selector: ["variable", "parameter"],
            format: ["camelCase"],
            modifiers: ["unused"],
            leadingUnderscore: "require",
        }, {
            selector: "variable",
            format: ["camelCase", "UPPER_CASE", "PascalCase"],
            modifiers: ["global"],
        }, {
            selector: "enumMember",
            format: ["UPPER_CASE"],
        }, {
            selector: "property",
            format: ["camelCase"],
            modifiers: ["private"],
            leadingUnderscore: "allow",
        }, {
            selector: "property",
            format: ["camelCase"],
            modifiers: ["protected"],
            leadingUnderscore: "allow",
        }, {
            selector: "typeLike",
            format: ["PascalCase"],
        }, {
            selector: ["property"],
            format: null,
            modifiers: ["requiresQuotes"],
        }],

        "@typescript-eslint/no-invalid-this": ["error", {
            capIsConstructor: false,
        }],

        "@typescript-eslint/member-ordering": ["error", {
            default: [
                "decorated-field",
                "field",
                "decorated-get",
                "get",
                "decorated-set",
                "set",
                "constructor",
                "public-decorated-method",
                "public-method",
                "protected-decorated-method",
                "protected-method",
                "private-decorated-method",
                "private-method",
            ],
        }],

        "@stylistic/semi": ["error", "always"],
        "@typescript-eslint/consistent-type-assertions": "error",
        "@stylistic/member-delimiter-style": "error",
        "@typescript-eslint/no-invalid-void-type": "error",
        "@typescript-eslint/prefer-function-type": "error",
        "@typescript-eslint/no-empty-interface": "error",
        "@typescript-eslint/unified-signatures": "error",
        "@typescript-eslint/default-param-last": "error",
        "@typescript-eslint/no-misused-new": "error",
        "@typescript-eslint/await-thenable": "error",
        "@angular-eslint/use-pipe-transform-interface": "warn",
        "@angular-eslint/no-empty-lifecycle-method": "warn",
        "@angular-eslint/prefer-output-readonly": "warn",

        "@angular-eslint/component-max-inline-declarations": ["error", {
            template: 0,
            styles: 0,
        }],

        "@angular-eslint/component-selector": ["error", {
            type: ["element", "attribute"],
            prefix: "gol",
            style: "kebab-case",
        }],

        "@angular-eslint/no-conflicting-lifecycle": "error",
        "@angular-eslint/use-lifecycle-interface": "error",
        "@angular-eslint/no-attribute-decorator": "error",
        "@angular-eslint/use-component-selector": "error",
        "@angular-eslint/contextual-lifecycle": "error",
        "@angular-eslint/no-output-native": "error",
        "sonarjs/no-unused-collection": "warn",
        "sonarjs/no-element-overwrite": "warn",
        "sonarjs/no-empty-collection": "warn",
        "sonarjs/no-redundant-jump": "warn",
        "sonarjs/no-ignored-return": "warn",
        "sonarjs/no-nested-switch": "warn",
        "sonarjs/max-switch-cases": "warn",
        "sonarjs/no-small-switch": "warn",
        "sonarjs/no-use-of-empty-return-value": "error",
        "sonarjs/prefer-single-boolean-return": "error",
        "sonarjs/no-collection-size-mischeck": "error",
        "sonarjs/no-nested-template-literals": "off",
        "sonarjs/no-all-duplicated-branches": "error",
        "sonarjs/no-gratuitous-expressions": "error",
        "sonarjs/no-inverted-boolean-check": "error",
        "sonarjs/no-identical-expressions": "error",
        "sonarjs/no-same-line-conditional": "error",
        "sonarjs/no-identical-conditions": "error",
        "sonarjs/prefer-immediate-return": "error",
        "sonarjs/no-duplicated-branches": "error",
        "sonarjs/no-identical-functions": "error",
        "sonarjs/no-one-iteration-loop": "error",
        "sonarjs/non-existent-operator": "error",
        "sonarjs/prefer-object-literal": "error",
        "sonarjs/no-redundant-boolean": "error",
        "sonarjs/no-duplicate-string": "error",
        "sonarjs/no-extra-arguments": "error",
        "sonarjs/no-collapsible-if": "error",
        "sonarjs/prefer-while": "error",
        "import/no-useless-path-segments": "warn",
        "import/newline-after-import": "warn",
        "import/no-deprecated": "warn",
        "import/group-exports": "off",
        "import/exports-last": "warn",
        "import/first": "warn",

        "import/order": ["warn", {
            groups: [
                ["builtin", "external"],
                "internal",
                ["parent", "sibling", "index"],
                "unknown",
            ],

            pathGroups: [{
                pattern: "@*/**",
                group: "external",
            }, {
                pattern: "apri*/**",
                group: "internal",
            }, {
                pattern: "src/**",
                group: "internal",
            }],

            pathGroupsExcludedImportTypes: [],
            "newlines-between": "always",

            alphabetize: {
                order: "asc",
                caseInsensitive: true,
            },
        }],

        "import/no-duplicates": "error",
        "import/export": "error",
        "unused-imports/no-unused-imports": "warn",
        "jsdoc/check-access": "warn",
        "jsdoc/check-alignment": "warn",
        "jsdoc/check-param-names": "warn",
        "jsdoc/check-tag-names": "warn",
        "jsdoc/check-types": "warn",

        "jsdoc/tag-lines": ["warn", "any", {
            startLines: 1,
        }],

        "jsdoc/empty-tags": ["warn", {
            tags: ["export"],
        }],

        "jsdoc/match-description": ["warn", {
            tags: {
                param: {
                    match: "^([a-z][\\s\\S]*[.?!])?$",
                    message: "Parameter description should begin with a lower case letter and end with a full stop.",
                },

                returns: {
                    match: "^([a-z]|[\\s\\S]*[.?!])?$",
                    message: "Return value description should begin with a lower case letter and end with a full stop.",
                },

                template: {
                    match: "^(extends\\s(keyof\\s)?\\{@link\\s\\S*\\}(\\s=\\s\\{@link\\s\\S*\\})?)?$",
                    message: "Template description should match this format: 'extends (keyof)? {@link VALUE}( = {@link VALUE})?'\nwhere 'VALUE' can be replaced with any string and '(string)?' is an optional part of the description.",
                },

                constructor: {
                    match: "^$",
                    message: "@constructor should be empty.",
                },
            },

            message: "Block comment description should begin with an upper case letter and end with any punctuation sign in [.!?].",
            contexts: ["any"],
        }],

        "jsdoc/multiline-blocks": ["warn", {
            noSingleLineBlocks: true,
            singleLineTags: [],
        }],

        "jsdoc/no-multi-asterisks": "warn",

        "jsdoc/require-description": ["warn", {
            contexts: ["any"],
            exemptedBy: ["inheritdoc", "constructor"],
        }],

        "jsdoc/require-hyphen-before-param-description": ["warn", "never", {
            tags: {
                "*": "never",
            },
        }],

        "jsdoc/require-jsdoc": ["warn", {
            require: {
                FunctionDeclaration: true,
                ClassDeclaration: true,
                MethodDefinition: true,
            },

            checkSetters: true,
            checkGetters: true,
            enableFixer: false,

            contexts: [
                "ClassProperty",
                "Interface",
                "TSMethodSignature",
                "TSTypeAliasDeclaration",
                "TSInterfaceDeclaration",
                "TSEnumDeclaration",
            ],
        }],

        "jsdoc/require-param-name": ["warn", {
            contexts: ["any"],
        }],

        "jsdoc/require-param-type": ["warn", {
            contexts: ["any"],
        }],

        "jsdoc/require-param": ["warn", {
            checkSetters: true,
        }],

        "jsdoc/require-returns-check": ["warn", {
            exemptGenerators: false,
            exemptAsync: false,
            reportMissingReturnForUndefinedTypes: true,
        }],

        "jsdoc/require-returns-type": ["warn", {
            contexts: ["any"],
        }],

        "jsdoc/require-returns": "warn",
    },
}, {
    files: ["**/*.html"],

    plugins: {
        "@angular-eslint/template": angularEslintTemplate,
    },

    languageOptions: {
        parser: parser,
    },

    rules: {
        "@angular-eslint/template/attributes-order": ["warn", {
            alphabetical: true,

            order: [
                "STRUCTURAL_DIRECTIVE",
                "TEMPLATE_REFERENCE",
                "ATTRIBUTE_BINDING",
                "INPUT_BINDING",
                "TWO_WAY_BINDING",
                "OUTPUT_BINDING",
            ],
        }],

        "@angular-eslint/template/label-has-associated-control": "warn",
        "@angular-eslint/template/elements-content": "warn",
        "@angular-eslint/template/no-inline-styles": "warn",
        "@angular-eslint/template/banana-in-box": "warn",
        "@angular-eslint/template/eqeqeq": "warn",
        "@angular-eslint/template/no-duplicate-attributes": "error",
        "@angular-eslint/template/conditional-complexity": "error",
        "@angular-eslint/template/no-any": "error",
    },
}]);