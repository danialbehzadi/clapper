const { GObject, Gtk, Pango } = imports.gi;
const Misc = imports.clapper_src.misc;

var HeaderBarBase = GObject.registerClass(
class ClapperHeaderBarBase extends Gtk.HeaderBar
{
    _init(window)
    {
        super._init({
            can_focus: false,
        });

        let clapperPath = Misc.getClapperPath();
        let uiBuilder = Gtk.Builder.new_from_file(
            `${clapperPath}/ui/clapper.ui`
        );
        let models = {
            addMediaMenu: uiBuilder.get_object('addMediaMenu'),
            settingsMenu: uiBuilder.get_object('settingsMenu'),
        };

        this.add_css_class('noborder');
        this.set_title_widget(this._createWidgetForWindow(window));

        let addMediaButton = new Gtk.MenuButton({
            icon_name: 'list-add-symbolic',
        });
        let addMediaPopover = new HeaderBarPopover(models.addMediaMenu);
        addMediaButton.set_popover(addMediaPopover);
        this.pack_start(addMediaButton);

        let openMenuButton = new Gtk.MenuButton({
            icon_name: 'open-menu-symbolic',
        });
        let settingsPopover = new HeaderBarPopover(models.settingsMenu);
        openMenuButton.set_popover(settingsPopover);
        this.pack_end(openMenuButton);

        let buttonsBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
        });
        buttonsBox.add_css_class('linked');

        let floatButton = new Gtk.Button({
            icon_name: 'preferences-desktop-remote-desktop-symbolic',
        });
        floatButton.connect('clicked', this._onFloatButtonClicked.bind(this));
        buttonsBox.append(floatButton);

        let fullscreenButton = new Gtk.Button({
            icon_name: 'view-fullscreen-symbolic',
        });
        fullscreenButton.connect('clicked', this._onFullscreenButtonClicked.bind(this));

        buttonsBox.append(fullscreenButton);
        this.pack_end(buttonsBox);
    }

    updateHeaderBar(title, subtitle)
    {
        this.titleLabel.label = title;
        this.subtitleLabel.visible = (subtitle !== null);

        if(subtitle)
            this.subtitleLabel.label = subtitle;
    }

    _createWidgetForWindow(window)
    {
        let box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            valign: Gtk.Align.CENTER,
        });

        this.titleLabel = new Gtk.Label({
            halign: Gtk.Align.CENTER,
            single_line_mode: true,
            ellipsize: Pango.EllipsizeMode.END,
            width_chars: 5,
        });
        this.titleLabel.add_css_class('title');
        this.titleLabel.set_parent(box);

        window.bind_property('title', this.titleLabel, 'label',
            GObject.BindingFlags.SYNC_CREATE
        );

        this.subtitleLabel = new Gtk.Label({
            halign: Gtk.Align.CENTER,
            single_line_mode: true,
            ellipsize: Pango.EllipsizeMode.END,
        });
        this.subtitleLabel.add_css_class('subtitle');
        this.subtitleLabel.set_parent(box);
        this.subtitleLabel.visible = false;

        return box;
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
        let root = this.get_root();
        let clapperWidget = root.get_child();

        if(
            !clapperWidget
            || !clapperWidget.player
            || !clapperWidget.player.widget
        )
            return;

        clapperWidget.player.widget.grab_focus();
    }
});