const { Gio, GLib, GObject, Gst, GstPlayer, Gtk } = imports.gi;
const Debug = imports.clapper_src.debug;
const Misc = imports.clapper_src.misc;

/* PlayFlags are not exported through GI */
Gst.PlayFlags = {
  VIDEO: 1,
  AUDIO: 2,
  TEXT: 4,
  VIS: 8,
  SOFT_VOLUME: 16,
  NATIVE_AUDIO: 32,
  NATIVE_VIDEO: 64,
  DOWNLOAD: 128,
  BUFFERING: 256,
  DEINTERLACE: 512,
  SOFT_COLORBALANCE: 1024,
  FORCE_FILTERS: 2048,
  FORCE_SW_DECODERS: 4096,
};

let { debug } = Debug;
let { settings } = Misc;

var PlayerBase = GObject.registerClass(
class ClapperPlayerBase extends GstPlayer.Player
{
    _init()
    {
        if(!Gst.is_initialized())
            Gst.init(null);

        let plugin = 'gtk4glsink';
        let gtkglsink = Gst.ElementFactory.make(plugin, null);

        if(!gtkglsink) {
            return debug(new Error(
                `Could not load "${plugin}".`
                    + ' Do you have gstreamer-plugins-good-gtk4 installed?'
            ));
        }

        let glsinkbin = Gst.ElementFactory.make('glsinkbin', null);
        glsinkbin.sink = gtkglsink;

        let context = GLib.MainContext.ref_thread_default();
        let acquired = context.acquire();
        debug(`default context acquired: ${acquired}`);

        let dispatcher = new GstPlayer.PlayerGMainContextSignalDispatcher({
            application_context: context,
        });
        let renderer = new GstPlayer.PlayerVideoOverlayVideoRenderer({
            video_sink: glsinkbin
        });

        super._init({
            signal_dispatcher: dispatcher,
            video_renderer: renderer
        });

        this.gtkglsink = gtkglsink;
        this.widget.vexpand = true;
        this.widget.hexpand = true;

        this.state = GstPlayer.PlayerState.STOPPED;
        this.visualization_enabled = false;

        this.set_all_plugins_ranks();
        this.set_initial_config();
        this.set_and_bind_settings();

        settings.connect('changed', this._onSettingsKeyChanged.bind(this));
    }

    get widget()
    {
        return this.gtkglsink.widget;
    }

    set_and_bind_settings()
    {
        let settingsToSet = [
            'seeking-mode',
            'audio-offset',
            'subtitle-offset',
        ];

        for(let key of settingsToSet)
            this._onSettingsKeyChanged(settings, key);

        //let flag = Gio.SettingsBindFlags.GET;
    }

    set_initial_config()
    {
        let gstPlayerConfig = {
            position_update_interval: 1000,
            user_agent: 'clapper',
        };

        for(let option of Object.keys(gstPlayerConfig))
            this.set_config_option(option, gstPlayerConfig[option]);

        this.set_mute(false);

        /* FIXME: change into option in preferences */
        let pipeline = this.get_pipeline();
        pipeline.ring_buffer_max_size = 8 * 1024 * 1024;
    }

    set_config_option(option, value)
    {
        let setOption = GstPlayer.Player[`config_set_${option}`];
        if(!setOption)
            return debug(`unsupported option: ${option}`, 'LEVEL_WARNING');

        let config = this.get_config();
        setOption(config, value);
        let success = this.set_config(config);

        if(!success)
            debug(`could not change option: ${option}`);
    }

    /* FIXME: add in prefs and move to bind_settings() */
    set_subtitle_font_desc(desc)
    {
        let pipeline = this.get_pipeline();
        pipeline.subtitle_font_desc = desc;
    }

    set_all_plugins_ranks()
    {
        let data = [];

        /* Set empty plugin list if someone messed it externally */
        try {
            data = JSON.parse(settings.get_string('plugin-ranking'));
            if(!Array.isArray(data))
                throw new Error('plugin ranking data is not an array!');
        }
        catch(err) {
            debug(err);
            settings.set_string('plugin-ranking', "[]");
        }

        for(let plugin of data) {
            if(!plugin.apply || !plugin.name)
                continue;

            this.set_plugin_rank(plugin.name, plugin.rank);
        }
    }

    set_plugin_rank(name, rank)
    {
        let gstRegistry = Gst.Registry.get();
        let feature = gstRegistry.lookup_feature(name);
        if(!feature)
            return debug(`plugin unavailable: ${name}`);

        let oldRank = feature.get_rank();
        if(rank === oldRank)
            return;

        feature.set_rank(rank);
        debug(`changed rank: ${oldRank} -> ${rank} for ${name}`);
    }

    draw_black(isEnabled)
    {
        this.gtkglsink.ignore_textures = isEnabled;

        if(this.state !== GstPlayer.PlayerState.PLAYING)
            this.widget.queue_render();
    }

    _onSettingsKeyChanged(settings, key)
    {
        let value;

        switch(key) {
            case 'seeking-mode':
                let isSeekMode = (typeof this.set_seek_mode !== 'undefined');
                this.seekingMode = settings.get_string('seeking-mode');
                switch(this.seekingMode) {
                    case 'fast':
                        if(isSeekMode)
                            this.set_seek_mode(GstPlayer.PlayerSeekMode.FAST);
                        else
                            this.set_config_option('seek_fast', true);
                        break;
                    case 'accurate':
                        if(isSeekMode)
                            this.set_seek_mode(GstPlayer.PlayerSeekMode.ACCURATE);
                        else {
                            this.set_config_option('seek_fast', false);
                            this.set_config_option('seek_accurate', true);
                        }
                        break;
                    default:
                        if(isSeekMode)
                            this.set_seek_mode(GstPlayer.PlayerSeekMode.DEFAULT);
                        else {
                            this.set_config_option('seek_fast', false);
                            this.set_config_option('seek_accurate', false);
                        }
                        break;
                }
                break;
            case 'render-shadows':
                let root = this.widget.get_root();
                if(root && root.isClapperApp) {
                    let cssClass = 'gpufriendly';
                    let renderShadows = settings.get_boolean('render-shadows');
                    let hasShadows = !root.has_css_class(cssClass);

                    if(renderShadows === hasShadows)
                        break;

                    let action = (renderShadows) ? 'remove' : 'add';
                    root[action + '_css_class'](cssClass);
                }
                break;
            case 'audio-offset':
                value = Math.round(settings.get_double(key) * -1000000);
                this.set_audio_video_offset(value);
                debug(`set audio-video offset: ${value}`);
                break;
            case 'subtitle-offset':
                value = Math.round(settings.get_double(key) * -1000000);
                this.set_subtitle_video_offset(value);
                debug(`set subtitle-video offset: ${value}`);
                break;
            default:
                break;
        }
    }
});
