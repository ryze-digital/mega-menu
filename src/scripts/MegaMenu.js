import * as utils from '@ryze-digital/js-utilities';
import { HeightEqualizer } from './HeightEqualizer.js';

export class MegaMenu extends utils.Base {
    /**
     * @type {NodeList}
     */
    #subLevelTriggers;

    /**
     * @type {utils.BreakpointProvider}
     */
    #breakpointProvider;

    /**
     * @type {MediaQueryList}
     */
    #breakpoint;

    /**
     * {HeightEqualizer}
     */
    #heightEqualizer;

    /**
     * @type {NodeList}
     */
    #activeItems;

    /**
     * @type {HTMLElement}
     */
    #topLevelWrapper;

    /**
     *
     * @param {object} options
     * @param {HTMLElement} [options.el]
     * @param {HTMLElement} [options.menuToggle]
     * @param {string} [options.breakpoint]
     * @param {object} [options.classes]
     * @param {string} [options.classes.levelWrapper]
     * @param {string} [options.classes.subLevelOpen]
     * @param {string} [options.classes.activeItems]
     */
    constructor(options) {
        super({
            el: document.querySelector('[data-mega-menu]'),
            menuToggle: document.querySelector('[data-mega-menu-toggle]'),
            breakpoint: 'large',
            openActiveSubLevel: true,
            classes: {
                levelWrapper: 'level-wrapper',
                subLevelOpen: 'open',
                activeItems: 'is-active'
            }
        }, options);

        this.#subLevelTriggers = this.options.el.querySelectorAll('li:has(ul) > button');
        this.#breakpointProvider = new utils.BreakpointProvider();
        this.#breakpoint = window.matchMedia(`(min-width: ${this.#breakpointProvider.breakpoints[this.options.breakpoint]})`);
        this.#heightEqualizer = new HeightEqualizer(this.options, this.#breakpoint);
        this.#activeItems = this.options.el.querySelectorAll(`.${this.options.classes.activeItems}`);
    }

    init() {
        let outsideClickBound = false;

        this.#topLevelWrapper = this.options.el.querySelector('.level-wrapper');

        this.on(this.options.menuToggle, 'click', () => {
            this.#toggleSubLevel(this.options.el.querySelector(`.${this.options.classes.levelWrapper}`));
        });

        this.#subLevelTriggers.forEach((trigger) => {
            this.on(trigger, 'click', ({ target }) => {
                this.#closeSiblingSubLevels(target);
                this.#toggleSubLevel(target.closest('button').nextElementSibling);

                if (this.#getParents(trigger, '.level-wrapper').length === 1 && outsideClickBound === false) {
                    this.#bindOutsideClick();
                    outsideClickBound = true;
                }
            });
        });

        this.options.el.querySelectorAll('[data-back]').forEach((backButton) => {
            this.on(backButton, 'click', this.#back);
        });

        this.options.el.querySelectorAll('[data-close]').forEach((closeButton) => {
            this.on(closeButton, 'click', () => {
                this.#closeAllSubLevels();
            });
        });

        if (this.#breakpoint.matches) {
            this.#setInert(this.#topLevelWrapper, false);
        }

        this.#breakpoint.addListener(this.#checkBreakpoint);

        if (this.options.openActiveSubLevel) {
            this.#openActiveSubLevel();
        }

        this.on(document, 'keydown', (event) => {
            if (event.key === 'Escape') {
                const openSubLevel = this.options.el.querySelector(`.${this.options.classes.subLevelOpen}`);

                if (openSubLevel === null) {
                    return;
                }

                this.#closeSubLevel(openSubLevel);
            }
        });
    }

    /**
     *
     * @fires MegaMenu#beforeDestroy
     * @fires MegaMenu#afterDestroy
     */
    destroy() {
        /**
         * @event MegaMenu#beforeDestroy
         */
        this.emitEvent('beforeDestroy');

        this.#closeAllSubLevels();
        this.#breakpoint.removeListener(this.#checkBreakpoint);
        this.#heightEqualizer.destroy();
        this.offAll();

        /**
         * @event MegaMenu#afterDestroy
         */
        this.emitEvent('afterDestroy');
    }

    #checkBreakpoint = () => {
        this.#closeAllSubLevels(this.options.el, true);

        if (this.#breakpoint.matches) {
            this.#setInert(this.#topLevelWrapper, false);
        } else {
            this.#setInert(this.#topLevelWrapper, true);
        }
    };

    #back = ({ target }) => {
        const subLevel = target.closest(`.${this.options.classes.subLevelOpen}`);

        this.#closeSubLevel(subLevel);
    };

    /**
     *
     * @param {HTMLDivElement} subLevel
     */
    #toggleSubLevel(subLevel) {
        if (subLevel.classList.contains(this.options.classes.subLevelOpen)) {
            this.#closeSubLevel(subLevel);
        } else {
            this.#openSubLevel(subLevel);
        }

        this.#heightEqualizer.equalize(subLevel);
    }

    /**
     *
     * @fires MegaMenu#beforeMenuOpen
     * @fires MegaMenu#beforeSublevelOpen
     * @fires MegaMenu#afterMenuOpen
     * @fires MegaMenu#afterSublevelOpen
     * @param {HTMLDivElement} subLevel
     */
    #openSubLevel(subLevel) {
        const parentLevels = this.#getParents(subLevel, '.level-wrapper').length;
        const subLevelTrigger = subLevel.previousElementSibling;

        let eventType = parentLevels === 0 ? 'Menu' : 'Sublevel';

        if (this.#breakpoint.matches) {
            eventType = parentLevels === 1 ? 'Menu' : 'Sublevel';
        }

        /**
         * @event MegaMenu#beforeMenuOpen
         */
        /**
         * @event MegaMenu#beforeSublevelOpen
         */
        this.emitEvent(`before${eventType}Open`);

        if (parentLevels === 1 && this.#breakpoint.matches) {
            this.#heightEqualizer.start();
        }

        if (parentLevels > 0 && !this.#breakpoint.matches) {
            const directParentLevel = this.#getParents(subLevel, '.level-wrapper')[0];

            if (directParentLevel.querySelector('ul').offsetHeight > subLevel.querySelector('ul').offsetHeight) {
                subLevel.style.transform = `translateY(${directParentLevel.scrollTop}px)`;
            }
        }

        subLevel.classList.add(this.options.classes.subLevelOpen);
        this.#setInert(subLevel, false);

        if (subLevelTrigger !== null) {
            subLevelTrigger.ariaExpanded = 'true';
        }

        if (parentLevels === 0) {
            this.options.menuToggle.ariaExpanded = 'true';
        }

        /**
         * @event MegaMenu#afterMenuOpen
         */
        /**
         * @event MegaMenu#afterSublevelOpen
         */
        this.emitEvent(`after${eventType}Open`);
    }

    /**
     *
     * @fires MegaMenu#beforeMenuClose
     * @fires MegaMenu#beforeSublevelClose
     * @fires MegaMenu#afterMenuClose
     * @fires MegaMenu#afterSublevelClose
     * @param {HTMLDivElement} subLevel
     * @param {boolean} onViewSizeChange
     */
    #closeSubLevel(subLevel, onViewSizeChange = false) {
        const parentLevels = this.#getParents(subLevel, '.level-wrapper').length;
        const subLevelTrigger = subLevel.previousElementSibling;

        let eventType = parentLevels === 0 ? 'Menu' : 'Sublevel';

        if (this.#breakpoint.matches) {
            eventType = parentLevels === 1 ? 'Menu' : 'Sublevel';
        }

        if (onViewSizeChange) {
            eventType = 'Menu';
        }

        /**
         * @event MegaMenu#beforeMenuClose
         */
        /**
         * @event MegaMenu#beforeSublevelClose
         */
        this.emitEvent(`before${eventType}Close`);

        subLevel.classList.remove(this.options.classes.subLevelOpen);
        this.#setInert(subLevel, true);

        if (subLevelTrigger !== null) {
            subLevelTrigger.ariaExpanded = 'false';
        }

        if (parentLevels === 0) {
            this.options.menuToggle.ariaExpanded = 'false';
        }

        if(parentLevels === 1) {
            this.#heightEqualizer.stop();
        }

        if (parentLevels > 0 && !this.#breakpoint.matches) {
            const handleTransitionEnd = (event) => {
                if (event.target !== subLevel) {
                    return;
                }

                if (event.propertyName === 'translate') {
                    subLevel.style.transform = '';
                    this.off(subLevel, 'transitionend');
                }
            };

            this.on(subLevel,'transitionend', handleTransitionEnd);
        }

        /**
         * @event MegaMenu#afterMenuClose
         */
        /**
         * @event MegaMenu#afterSublevelClose
         */
        this.emitEvent(`after${eventType}Close`);
    }

    /**
     *
     * @param {HTMLElement} parent
     * @param {boolean} onViewSizeChange
     */
    #closeAllSubLevels(parent = this.options.el, onViewSizeChange = false) {
        parent.querySelectorAll(`.${this.options.classes.subLevelOpen}`).forEach((openElement) => {
            this.#closeSubLevel(openElement, onViewSizeChange);
            openElement.style.removeProperty('transform');
        });
    }

    /**
     *
     * @param {HTMLElement} clickedElement
     */
    #closeSiblingSubLevels(clickedElement) {
        const li = clickedElement.closest('li');

        utils.Selectors.siblings(li).forEach((sibling) => {
            this.#closeAllSubLevels(sibling);
        });
    }

    /**
     *
     * @param {HTMLElement} element
     * @param {string} selector
     * @returns {Array}
     */
    #getParents(element, selector) {
        const parents = [];

        while ((element = element.parentElement) && element !== document) {
            if (!selector || element.matches(selector)) {
                parents.push(element);
            }
        }

        return parents;
    }

    #openActiveSubLevel() {
        this.#activeItems.forEach((activeItem, level) => {
            const levelWrapper = activeItem.querySelector(`.${this.options.classes.levelWrapper}`);

            if (this.#breakpoint.matches && level === 0) {
                return;
            }

            if (levelWrapper === null) {
                return;
            }

            this.#openSubLevel(levelWrapper);
        });
    }

    #bindOutsideClick() {
        this.on(document, 'click', (event) => {
            if (this.#breakpoint.matches && !this.options.el.contains(event.target) && this.options.el.querySelector(`.${this.options.classes.subLevelOpen}`) !== null) {
                this.#closeSubLevel(this.options.el.querySelector(`.${this.options.classes.subLevelOpen}`));
            }
        });
    }

    /**
     *
     * @param {HTMLDivElement} levelWrapper
     * @param {boolean} inert
     */
    #setInert(levelWrapper, inert) {
        levelWrapper.inert = inert;
    }
}