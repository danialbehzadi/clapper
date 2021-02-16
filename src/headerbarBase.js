const { GObject, Gtk } = imports.gi;
const Misc = imports.src.misc;

var HeaderBarBase = GObject.registerClass(
class ClapperHeaderBarBase extends Gtk.Box
{
    _init()
    {
        super._init({
            can_focus: false,
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 6,
            margin_top: 6,
            margin_start: 6,
            margin_end: 6,
        });

        this.isMaximized = false;
        this.isMenuOnLeft = true;

        const clapperPath = Misc.getClapperPath();
        const uiBuilder = Gtk.Builder.new_from_file(
            `${clapperPath}/ui/clapper.ui`
        );

        this.menuWidget = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            valign: Gtk.Align.CENTER,
            spacing: 6,
        });

        this.menuButton = new Gtk.MenuButton({
            icon_name: 'open-menu-symbolic',
            valign: Gtk.Align.CENTER,
        });
        const mainMenuModel = uiBuilder.get_object('mainMenu');
        const mainMenuPopover = new HeaderBarPopover(mainMenuModel);
        this.menuButton.set_popover(mainMenuPopover);
        this.menuButton.add_css_class('circular');
        this.menuWidget.append(this.menuButton);

        this.extraButtonsBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            valign: Gtk.Align.CENTER,
        });
        this.extraButtonsBox.add_css_class('linked');

        const floatButton = new Gtk.Button({
            icon_name: 'go-bottom-symbolic',
        });
        floatButton.add_css_class('circular');
        floatButton.connect('clicked',
            this._onFloatButtonClicked.bind(this)
        );
        this.extraButtonsBox.append(floatButton);

        const fullscreenButton = new Gtk.Button({
            icon_name: 'view-fullscreen-symbolic',
        });
        fullscreenButton.add_css_class('circular');
        fullscreenButton.connect('clicked',
            this._onFullscreenButtonClicked.bind(this)
        );
        this.extraButtonsBox.append(fullscreenButton);
        this.menuWidget.append(this.extraButtonsBox);

        this.spacerWidget = new Gtk.Box({
            hexpand: true,
        });

        this.minimizeWidget = this._getWindowButton('minimize');
        this.maximizeWidget = this._getWindowButton('maximize');
        this.closeWidget = this._getWindowButton('close');

        const gtkSettings = Gtk.Settings.get_default();
        this._onLayoutUpdate(gtkSettings);

        gtkSettings.connect(
            'notify::gtk-decoration-layout',
            this._onLayoutUpdate.bind(this)
        );
    }

    setMenuOnLeft(isOnLeft)
    {
        if(this.isMenuOnLeft === isOnLeft)
            return;

        if(isOnLeft) {
            this.menuWidget.reorder_child_after(
                this.extraButtonsBox, this.menuButton
            );
        }
        else {
            this.menuWidget.reorder_child_after(
                this.menuButton, this.extraButtonsBox
            );
        }

        this.isMenuOnLeft = isOnLeft;
    }

    setMaximized(isMaximized)
    {
        if(this.isMaximized === isMaximized)
            return;

        this.maximizeWidget.icon_name = (isMaximized)
            ? 'window-restore-symbolic'
            : 'window-maximize-symbolic';

        this.isMaximized = isMaximized;
    }

    _onLayoutUpdate(gtkSettings)
    {
        const gtkLayout = gtkSettings.gtk_decoration_layout;

        this._replaceButtons(gtkLayout);
    }

    _replaceButtons(gtkLayout)
    {
        const modLayout = gtkLayout.replace(':', ',spacer,');
        const layoutArr = modLayout.split(',');

        let lastWidget = null;
        let showMinimize = false;
        let showMaximize = false;
        let showClose = false;
        let spacerAdded = false;

        for(let name of layoutArr) {
            const widget = this[`${name}Widget`];
            if(!widget) continue;

            if(!widget.parent)
                this.append(widget);
            else
                this.reorder_child_after(widget, lastWidget);

            switch(name) {
                case 'spacer':
                    spacerAdded = true;
                    break;
                case 'minimize':
                    showMinimize = true;
                    break;
                case 'maximize':
                    showMaximize = true;
                    break;
                case 'close':
                    showClose = true;
                    break;
                case 'menu':
                    this.setMenuOnLeft(!spacerAdded);
                    break;
                default:
                    break;
            }

            lastWidget = widget;
        }

        this.minimizeWidget.visible = showMinimize;
        this.maximizeWidget.visible = showMaximize;
        this.closeWidget.visible = showClose;
    }

    _getWindowButton(name)
    {
        const button = new Gtk.Button({
            icon_name: `window-${name}-symbolic`,
            valign: Gtk.Align.CENTER,
        });
        button.add_css_class('circular');

        const action = (name === 'maximize')
            ? 'window.toggle-maximized'
            : 'window.' + name;

        button.connect('clicked',
            this._onWindowButtonActivate.bind(this, action)
        );

        return button;
    }

    _onWindowButtonActivate(action)
    {
    }

    _onFloatButtonClicked()
    {
    }

    _onFullscreenButtonClicked()
    {
    }
});

var HeaderBarPopover = GObject.registerClass(
class ClapperHeaderBarPopover extends Gtk.PopoverMenu
{
    _init(model)
    {
        super._init({
            menu_model: model,
        });

        this.connect('closed', this._onClosed.bind(this));
    }

    _onClosed()
    {
        const { child } = this.get_root();

        if(
            !child
            || !child.player
            || !child.player.widget
        )
            return;

        child.player.widget.grab_focus();
    }
});
