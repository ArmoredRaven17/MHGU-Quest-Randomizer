using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI.Xaml.Media.Imaging;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.UI.Windowing;
using System.Runtime.InteropServices;
using Windows.Graphics;
using Windows.Storage.Streams;
using Windows.UI;

namespace MHGU_Quest_Randomizer
{
    public sealed partial class MainWindow : Window
    {
        private List<Quest> _quests = new();
        private List<HunterArt> _arts = new();
        private List<Monster> _monsters = new();
        private bool _updatingTreeSelection = false;
        private bool _updatingArtSelection  = false;
        private bool _syncingLevels = false;
        private bool _loadingSettings = false;

        private List<BlacklistEntry> _blacklist = new();
        private (CheckBox Pill, string Name)[] _weaponPills = Array.Empty<(CheckBox, string)>();
        private (CheckBox Pill, string Name)[] _stylePills  = Array.Empty<(CheckBox, string)>();
        private (CheckBox Pill, string Name)[] _biasPills   = Array.Empty<(CheckBox, string)>();

        // Persisted settings (theme + filter state) in %LOCALAPPDATA%\MHGU Quest Randomizer\settings.json
        private sealed class BlacklistEntry
        {
            public string Weapon { get; set; } = "";
            public string Style  { get; set; } = "";
        }
        private sealed class AppSettings
        {
            public string ThemeColor    { get; set; } = "#4A4A4A";
            public List<string> ExWeapons  { get; set; } = new();
            public List<string> ExStyles   { get; set; } = new();
            public List<string> ExBiases   { get; set; } = new();
            public List<string> ExMonsters { get; set; } = new();
            public List<string> ExArts     { get; set; } = new();
            public List<BlacklistEntry> Blacklist { get; set; } = new();
            public bool Hyper { get; set; }
            public bool Egg { get; set; }
            public bool Gathering { get; set; }
            public bool SmMonsters { get; set; }
            public bool Prowler { get; set; }
            public bool ProwlerQuests { get; set; }
        }
        private static readonly JsonSerializerOptions SettingsJsonOpts = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            PropertyNameCaseInsensitive = true,
        };
        private AppSettings? _loadedSettings;

        private double _uiScale  = 1.0;
        private Color  _pillColor;
        private readonly SolidColorBrush _backgroundBrush = new(Color.FromArgb(0, 0, 0, 0));
        private readonly SolidColorBrush _titleBarBrush   = new();

        // Persistent brushes — mutating .Color propagates to controls already in Checked
        // visual state without needing a hover/state transition to refresh.
        private readonly SolidColorBrush _btnBg           = new();
        private readonly SolidColorBrush _btnBgHover      = new();
        private readonly SolidColorBrush _btnBgPress      = new();
        private readonly SolidColorBrush _btnBgDisable    = new();
        private readonly SolidColorBrush _btnBorder       = new();
        private readonly SolidColorBrush _btnBorderHover  = new();
        private readonly SolidColorBrush _btnBorderPress  = new();
        private readonly SolidColorBrush _cbFill          = new();
        private readonly SolidColorBrush _cbFillHover     = new();
        private readonly SolidColorBrush _cbFillPress     = new();
        private readonly SolidColorBrush _cbFillDisable   = new();
        private readonly SolidColorBrush _cbStroke        = new();
        private readonly SolidColorBrush _cbStrokeHover   = new();
        private readonly SolidColorBrush _cbStrokePress   = new();

        private static readonly Dictionary<string, string> DeviantFullNames = new(StringComparer.OrdinalIgnoreCase)
        {
            ["Redhelm"]     = "Redhelm Arzuros",
            ["Snowbaron"]   = "Snowbaron Lagombi",
            ["Stonefist"]   = "Stonefist Hermitaur",
            ["Dreadqueen"]  = "Dreadqueen Rathian",
            ["Drilltusk"]   = "Drilltusk Tetsucabra",
            ["Silverwind"]  = "Silverwind Nargacuga",
            ["Crystalbeard"]= "Crystalbeard Uragaan",
            ["Deadeye"]     = "Deadeye Yian Garuga",
            ["Dreadking"]   = "Dreadking Rathalos",
            ["Thunderlord"] = "Thunderlord Zinogre",
            ["Grimclaw"]    = "Grimclaw Tigrex",
            ["Hellblade"]   = "Hellblade Glavenus",
            ["Nightcloak"]  = "Nightcloak Malfestio",
            ["Rustrazor"]   = "Rustrazor Ceanataur",
            ["Soulseer"]    = "Soulseer Mizutsune",
            ["Boltreaver"]  = "Boltreaver Astalos",
            ["Elderfrost"]  = "Elderfrost Gammoth",
            ["Bloodbath"]   = "Bloodbath Diablos",
        };

        private static readonly Dictionary<string, Color> WeaponColors = new(StringComparer.OrdinalIgnoreCase)
        {
            ["Great Sword"]    = Hex("#ff505b"),
            ["Long Sword"]     = Hex("#9beaf1"),
            ["Sword & Shield"] = Hex("#dfd65f"),
            ["Dual Blades"]    = Hex("#6ac083"),
            ["Hammer"]         = Hex("#c3a3d2"),
            ["Hunting Horn"]   = Hex("#f89a64"),
            ["Lance"]          = Hex("#9fbcff"),
            ["Gunlance"]       = Hex("#f4baf5"),
            ["Switch Axe"]     = Hex("#aaaaaa"),
            ["Charge Blade"]   = Hex("#fc5800"),
            ["Insect Glaive"]  = Hex("#f5f5f5"),
            ["Light Bowgun"]   = Hex("#acd56b"),
            ["Heavy Bowgun"]   = Hex("#f8899c"),
            ["Bow"]            = Hex("#55edc4"),
            ["Prowler"]        = Hex("#c29930"),
        };

        private static readonly Dictionary<string, string> BiasIcons = new(StringComparer.OrdinalIgnoreCase)
        {
            ["Charisma"]   = "FourthGen-Palico_Icon_Blue.webp",
            ["Fighting"]   = "Palico_Weapon_Cutting_Icon_Red.webp",
            ["Protection"] = "FourthGen-Down_Arrow_Icon_Blue.webp",
            ["Assisting"]  = "MH4G-Trap_Icon_Purple.webp",
            ["Healing"]    = "MH4G-Horn_Icon_Green.webp",
            ["Bombing"]    = "MH4G-Barrel_Icon_Brown.webp",
            ["Gathering"]  = "MH4G-Boomerang_Icon_Blue.webp",
            ["Beast"]      = "FourthGen-Claw_Icon_Dark_Red.webp",
        };

        private static Color Hex(string h)
        {
            h = h.TrimStart('#');
            return Color.FromArgb(255,
                Convert.ToByte(h.Substring(0, 2), 16),
                Convert.ToByte(h.Substring(2, 2), 16),
                Convert.ToByte(h.Substring(4, 2), 16));
        }

        private const int BaseWindowWidth  = 860;
        private const int BaseWindowHeight = 500;

        // ─── Data models ───────────────────────────────────────────────────────

        public class Quest
        {
            public string Type      { get; set; } = "";
            public string Name      { get; set; } = "";
            public string Main      { get; set; } = "";
            public string Monster   { get; set; } = "";
            public int    Level     { get; set; }
            public bool   LgMonster { get; set; }
            public bool   Prowler   { get; set; }
            public bool   Hyper     { get; set; }
            public bool   Egg       { get; set; }
            public bool   Gathering { get; set; }
            public bool   SmMonsters{ get; set; }
            // Arena preset sets (parsed from quest descriptions): a hunter arena quest
            // offers ArenaWeapons; a Prowler arena quest offers ArenaBiases. Null otherwise.
            public List<string>? ArenaWeapons { get; set; }
            public List<string>? ArenaBiases  { get; set; }
        }

        private class HunterArt
        {
            public string HunterArtName { get; set; } = "";
            public string Weapon        { get; set; } = "";
        }

        private class Monster
        {
            public string MonsterName { get; set; } = "";
            public string Species     { get; set; } = "";
        }

        private class QuestItem
        {
            public string QuestLevel { get; set; } = "";
            public int    QuestValue { get; set; }
        }

        // ─── Construction ───────────────────────────────────────────────────────

        public MainWindow()
        {
            InitializeComponent();

            string baseDir = AppContext.BaseDirectory;
            var opts = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };

            _quests   = JsonSerializer.Deserialize<List<Quest>>(
                            File.ReadAllText(Path.Combine(baseDir, "QuestData.json")), opts) ?? new();
            _arts     = JsonSerializer.Deserialize<List<HunterArt>>(
                            File.ReadAllText(Path.Combine(baseDir, "Hunter Arts.json")), opts) ?? new();
            _monsters = JsonSerializer.Deserialize<List<Monster>>(
                            File.ReadAllText(Path.Combine(baseDir, "LgMonsters.json")), opts) ?? new();

            _weaponPills = new[]
            {
                (gsPill,  "Great Sword"),
                (lsPill,  "Long Sword"),
                (snsPill, "Sword & Shield"),
                (dbPill,  "Dual Blades"),
                (hmPill,  "Hammer"),
                (hhPill,  "Hunting Horn"),
                (lncPill, "Lance"),
                (glPill,  "Gunlance"),
                (saPill,  "Switch Axe"),
                (cbPill,  "Charge Blade"),
                (igPill,  "Insect Glaive"),
                (lbgPill, "Light Bowgun"),
                (hbgPill, "Heavy Bowgun"),
                (bowPill, "Bow"),
            };

            _stylePills = new[]
            {
                (guildPill,   "Guild"),
                (strikerPill, "Striker"),
                (adeptPill,   "Adept"),
                (aerialPill,  "Aerial"),
                (valorPill,   "Valor"),
                (alchemyPill, "Alchemy"),
            };

            _biasPills = new[]
            {
                (chrPill,  "Charisma"), (fghtPill, "Fighting"), (proPill, "Protection"), (assPill, "Assisting"),
                (hlgPill,  "Healing"),  (bmbPill,  "Bombing"),  (gthPill, "Gathering"),  (bstPill, "Beast"),
            };

            // Wire all filter pills to re-evaluate the Randomize button and persist filter state.
            RoutedEventHandler onPillChanged   = (_, _) => UpdateRandomizeButton();
            RoutedEventHandler onFilterChanged = (_, _) => SaveSettings();
            void Wire(CheckBox cb, bool affectsRandomize)
            {
                if (affectsRandomize) { cb.Checked += onPillChanged; cb.Unchecked += onPillChanged; }
                cb.Checked += onFilterChanged; cb.Unchecked += onFilterChanged;
            }
            foreach (var (pill, _) in _weaponPills) Wire(pill, true);
            foreach (var (pill, _) in _stylePills)  Wire(pill, true);
            foreach (var (pill, _) in _biasPills)   Wire(pill, true);
            Wire(prowlerPill, true);
            foreach (var t in new[] { hyperPill, eggPill, gatheringPill, smMonstersPill, prowlerQuestsPill }) Wire(t, false);

            // "Prowler Quests?" only makes sense when "Prowler?" is on — only Prowlers can
            // take Prowler quests. Disable + clear it whenever "Prowler?" is off.
            RoutedEventHandler syncProwlerQuests = (_, _) =>
            {
                bool on = prowlerPill.IsChecked == true;
                prowlerQuestsPill.IsEnabled = on;
                if (!on) prowlerQuestsPill.IsChecked = false;
            };
            prowlerPill.Checked   += syncProwlerQuests;
            prowlerPill.Unchecked += syncProwlerQuests;
            syncProwlerQuests(this, null!);   // initial state (Prowler off by default)

            rootGrid.Background = _backgroundBrush;
            // Opaque root so the Viewbox letterbox bars don't show the warm DWM window
            // base (which tints neutral surfaces — e.g. the White theme — brownish).
            windowRoot.Background = _backgroundBrush;

            ExtendsContentIntoTitleBar = true;
            SetTitleBar(appTitleBar);

            // Resize after layout so RasterizationScale reflects the actual DPI.
            rootGrid.Loaded += (_, _) => ResizeWindow(_uiScale);

            LoadPillIcons(baseDir);
            PopulateMonsterTree();
            PopulateArtTree();
            InitBlacklistCombos();

            // Register persistent brushes once so visual states hold the same object
            // reference — subsequent .Color mutations propagate immediately.
            appTitleBar.Background = _titleBarBrush;
            submitButton.Resources["AccentButtonBackground"]             = _btnBg;
            submitButton.Resources["AccentButtonBackgroundPointerOver"]  = _btnBgHover;
            submitButton.Resources["AccentButtonBackgroundPressed"]      = _btnBgPress;
            submitButton.Resources["AccentButtonBackgroundDisabled"]     = _btnBgDisable;
            submitButton.Resources["AccentButtonBorderBrush"]            = _btnBorder;
            submitButton.Resources["AccentButtonBorderBrushPointerOver"] = _btnBorderHover;
            submitButton.Resources["AccentButtonBorderBrushPressed"]     = _btnBorderPress;
            rootGrid.Resources["CheckBoxCheckBackgroundFillChecked"]              = _cbFill;
            rootGrid.Resources["CheckBoxCheckBackgroundFillCheckedPointerOver"]   = _cbFillHover;
            rootGrid.Resources["CheckBoxCheckBackgroundFillCheckedPressed"]       = _cbFillPress;
            rootGrid.Resources["CheckBoxCheckBackgroundFillCheckedDisabled"]      = _cbFillDisable;
            rootGrid.Resources["CheckBoxCheckBackgroundStrokeChecked"]            = _cbStroke;
            rootGrid.Resources["CheckBoxCheckBackgroundStrokeCheckedPointerOver"] = _cbStrokeHover;
            rootGrid.Resources["CheckBoxCheckBackgroundStrokeCheckedPressed"]     = _cbStrokePress;

            InitPillColor();
            ApplyLoadedFilters();   // restore saved filter selections (theme handled by InitPillColor)
            SetAppIcon(baseDir);
        }

        // ─── Load icons into pill Image elements ────────────────────────────────

        private void LoadPillIcons(string baseDir)
        {
            string weaponsDir = Path.Combine(baseDir, "Assets", "WeaponIcons");
            SetImage(gsIcon,  Path.Combine(weaponsDir, "icon_great_sword_tinted.png"));
            SetImage(lsIcon,  Path.Combine(weaponsDir, "icon_long_sword_tinted.png"));
            SetImage(snsIcon, Path.Combine(weaponsDir, "icon_sword_and_shield_tinted.png"));
            SetImage(dbIcon,  Path.Combine(weaponsDir, "icon_dual_blades_tinted.png"));
            SetImage(hmIcon,  Path.Combine(weaponsDir, "icon_hammer_tinted.png"));
            SetImage(hhIcon,  Path.Combine(weaponsDir, "icon_hunting_horn_tinted.png"));
            SetImage(lncIcon, Path.Combine(weaponsDir, "icon_lance_tinted.png"));
            SetImage(glIcon,  Path.Combine(weaponsDir, "icon_gunlance_tinted.png"));
            SetImage(saIcon,  Path.Combine(weaponsDir, "icon_switch_axe_tinted.png"));
            SetImage(cbIcon,  Path.Combine(weaponsDir, "icon_charge_blade_tinted.png"));
            SetImage(igIcon,  Path.Combine(weaponsDir, "icon_insect_glaive_tinted.png"));
            SetImage(lbgIcon, Path.Combine(weaponsDir, "icon_light_bowgun_tinted.png"));
            SetImage(hbgIcon, Path.Combine(weaponsDir, "icon_heavy_bowgun_tinted.png"));
            SetImage(bowIcon, Path.Combine(weaponsDir, "icon_bow_tinted.png"));

            string prowlerDir = Path.Combine(baseDir, "Assets", "ProwlerIcons");
            SetImage(chrIcon,  Path.Combine(prowlerDir, "FourthGen-Palico_Icon_Blue.webp"));
            SetImage(fghtIcon, Path.Combine(prowlerDir, "Palico_Weapon_Cutting_Icon_Red.webp"));
            SetImage(proIcon,  Path.Combine(prowlerDir, "FourthGen-Down_Arrow_Icon_Blue.webp"));
            SetImage(assIcon,  Path.Combine(prowlerDir, "MH4G-Trap_Icon_Purple.webp"));
            SetImage(hlgIcon,  Path.Combine(prowlerDir, "MH4G-Horn_Icon_Green.webp"));
            SetImage(bmbIcon,  Path.Combine(prowlerDir, "MH4G-Barrel_Icon_Brown.webp"));
            SetImage(gthIcon,  Path.Combine(prowlerDir, "MH4G-Boomerang_Icon_Blue.webp"));
            SetImage(bstIcon,  Path.Combine(prowlerDir, "FourthGen-Claw_Icon_Dark_Red.webp"));

            // Hyper aura overlay (shown over the target icon for Hyper quests)
            SetImage(hyperOverlay, Path.Combine(baseDir, "Assets", "MonsterIcons", "MHGU-Hyper_Monster_Icon.png"));
        }

        private static void SetImage(Image img, string path)
        {
            if (File.Exists(path))
                img.Source = new BitmapImage(new Uri(path));
        }

        private static void SetBitmapIcon(BitmapIcon icon, string path, Color color)
        {
            if (File.Exists(path))
            {
                icon.UriSource = new Uri(path);
                icon.Foreground = new SolidColorBrush(color);
            }
        }

        // ─── Populate monster tree ──────────────────────────────────────────────

        private void PopulateMonsterTree()
        {
            var grouped = _monsters
                .GroupBy(m => m.Species)
                .OrderBy(g => g.Key);

            foreach (var group in grouped)
            {
                var speciesNode = new TreeViewNode { Content = group.Key };
                foreach (var monster in group.OrderBy(m => m.MonsterName))
                    speciesNode.Children.Add(new TreeViewNode { Content = monster.MonsterName });
                monsterTreeView.RootNodes.Add(speciesNode);
            }

            // All checked by default: checked = included
            _updatingTreeSelection = true;
            foreach (TreeViewNode speciesNode in monsterTreeView.RootNodes)
            {
                monsterTreeView.SelectedNodes.Add(speciesNode);
                foreach (TreeViewNode child in speciesNode.Children)
                    monsterTreeView.SelectedNodes.Add(child);
            }
            _updatingTreeSelection = false;
        }

        private void ExpandMonsters_Click(object sender, RoutedEventArgs e)
        {
            foreach (TreeViewNode node in monsterTreeView.RootNodes)
                node.IsExpanded = true;
        }

        private void CollapseMonsters_Click(object sender, RoutedEventArgs e)
        {
            foreach (TreeViewNode node in monsterTreeView.RootNodes)
                node.IsExpanded = false;
        }

        // ─── Hunter Arts tree (Weapon → Art → Levels) ───────────────────────────

        private static string ArtBaseName(string n) =>
            System.Text.RegularExpressions.Regex.Replace(n, @" (III|II|I)$", "");

        private void PopulateArtTree()
        {
            var byWeapon = _arts
                .GroupBy(a => a.Weapon)
                .OrderBy(g => g.Key == "All" ? 0 : 1).ThenBy(g => g.Key);

            foreach (var wGroup in byWeapon)
            {
                var weaponNode = new TreeViewNode { Content = wGroup.Key };
                foreach (var baseGroup in wGroup.GroupBy(a => ArtBaseName(a.HunterArtName)).OrderBy(g => g.Key))
                {
                    var levels = baseGroup.OrderBy(a => a.HunterArtName).ToList();
                    if (levels.Count == 1)
                    {
                        weaponNode.Children.Add(new TreeViewNode { Content = levels[0].HunterArtName });
                    }
                    else
                    {
                        var baseNode = new TreeViewNode { Content = baseGroup.Key };
                        foreach (var art in levels)
                            baseNode.Children.Add(new TreeViewNode { Content = art.HunterArtName });
                        weaponNode.Children.Add(baseNode);
                    }
                }
                artTreeView.RootNodes.Add(weaponNode);
            }

            // All checked by default
            _updatingArtSelection = true;
            foreach (TreeViewNode w in artTreeView.RootNodes)
                SelectNodeTree(w);
            _updatingArtSelection = false;
        }

        private void SelectNodeTree(TreeViewNode node)
        {
            if (!artTreeView.SelectedNodes.Contains(node)) artTreeView.SelectedNodes.Add(node);
            foreach (TreeViewNode c in node.Children) SelectNodeTree(c);
        }

        // Depth-agnostic cascade: checking a node selects all descendants; unchecking a node
        // deselects its descendants — but only when the node was explicitly unchecked (none of
        // its own children are also being removed, which would mean it was auto-removed because
        // a descendant changed).
        private void ArtTreeView_SelectionChanged(TreeView sender, TreeViewSelectionChangedEventArgs args)
        {
            if (_updatingArtSelection) return;
            _updatingArtSelection = true;
            try
            {
                foreach (TreeViewNode node in args.AddedItems.OfType<TreeViewNode>().Where(n => n.Children.Count > 0))
                    AddDescendants(node, sender);

                var removed = new HashSet<TreeViewNode>(args.RemovedItems.OfType<TreeViewNode>());
                foreach (TreeViewNode node in args.RemovedItems.OfType<TreeViewNode>().Where(n => n.Children.Count > 0))
                    if (!node.Children.Any(c => removed.Contains(c)))
                        RemoveDescendants(node, sender);
            }
            finally { _updatingArtSelection = false; }
            SaveSettings();
        }

        private static void AddDescendants(TreeViewNode node, TreeView tv)
        {
            foreach (TreeViewNode c in node.Children)
            {
                if (!tv.SelectedNodes.Contains(c)) tv.SelectedNodes.Add(c);
                AddDescendants(c, tv);
            }
        }

        private static void RemoveDescendants(TreeViewNode node, TreeView tv)
        {
            foreach (TreeViewNode c in node.Children)
            {
                tv.SelectedNodes.Remove(c);
                RemoveDescendants(c, tv);
            }
        }

        private void CollectExcludedArts(TreeViewNode node, HashSet<string> excl)
        {
            if (node.Children.Count == 0)
            {
                if (!artTreeView.SelectedNodes.Contains(node))
                    excl.Add((string)node.Content);
            }
            else
                foreach (TreeViewNode c in node.Children) CollectExcludedArts(c, excl);
        }

        private void ExpandArts_Click(object sender, RoutedEventArgs e)
        {
            foreach (TreeViewNode n in artTreeView.RootNodes) SetExpandedTree(n, true);
        }

        private void CollapseArts_Click(object sender, RoutedEventArgs e)
        {
            foreach (TreeViewNode n in artTreeView.RootNodes) SetExpandedTree(n, false);
        }

        // ─── Blacklist ──────────────────────────────────────────────────────────

        private static readonly string[] _allWeapons =
        {
            "Great Sword","Long Sword","Sword & Shield","Dual Blades",
            "Hammer","Hunting Horn","Lance","Gunlance","Switch Axe",
            "Charge Blade","Insect Glaive","Light Bowgun","Heavy Bowgun","Bow",
        };
        private static readonly string[] _allStyles =
            { "Guild","Striker","Adept","Aerial","Valor","Alchemy" };

        private void InitBlacklistCombos()
        {
            foreach (var w in _allWeapons) blWeaponCombo.Items.Add(w);
            foreach (var s in _allStyles)  blStyleCombo.Items.Add(s);
            blWeaponCombo.SelectedIndex = 0;
            blStyleCombo.SelectedIndex  = 0;
            RenderBlacklist();
        }

        private void BlacklistAdd_Click(object sender, RoutedEventArgs e)
        {
            if (blWeaponCombo.SelectedItem is not string w || blStyleCombo.SelectedItem is not string s) return;
            if (_blacklist.Any(b => b.Weapon.Equals(w, StringComparison.OrdinalIgnoreCase)
                                 && b.Style.Equals(s, StringComparison.OrdinalIgnoreCase))) return;
            _blacklist.Add(new BlacklistEntry { Weapon = w, Style = s });
            RenderBlacklist();
            SaveSettings();
        }

        private void RenderBlacklist()
        {
            blacklistPanel.Children.Clear();
            if (_blacklist.Count == 0)
            {
                blacklistPanel.Children.Add(new TextBlock
                {
                    Text = "No restrictions added yet.",
                    Style = (Style)Application.Current.Resources["CaptionTextBlockStyle"],
                    Foreground = (Brush)Application.Current.Resources["TextFillColorSecondaryBrush"],
                });
                return;
            }
            for (int i = 0; i < _blacklist.Count; i++)
            {
                var entry = _blacklist[i];
                var idx = i; // capture for lambda
                var row = new Grid { ColumnSpacing = 8, HorizontalAlignment = HorizontalAlignment.Stretch };
                row.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
                row.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
                var label = new TextBlock
                {
                    Text = $"{entry.Weapon} + {entry.Style}",
                    VerticalAlignment = VerticalAlignment.Center,
                    TextTrimming = TextTrimming.CharacterEllipsis,
                    FontSize = 12,
                };
                Grid.SetColumn(label, 0);
                var removeBtn = new Button
                {
                    Content = "×",
                    Padding = new Thickness(6, 2, 6, 2),
                    FontSize = 13,
                    MinWidth = 0,
                };
                removeBtn.Click += (_, _) => { _blacklist.RemoveAt(idx); RenderBlacklist(); SaveSettings(); };
                Grid.SetColumn(removeBtn, 1);
                row.Children.Add(label);
                row.Children.Add(removeBtn);
                blacklistPanel.Children.Add(row);
            }
        }

        private static void SetExpandedTree(TreeViewNode node, bool expanded)
        {
            if (node.Children.Count == 0) return;
            node.IsExpanded = expanded;
            foreach (TreeViewNode c in node.Children) SetExpandedTree(c, expanded);
        }

        // ─── Quest level dropdown ───────────────────────────────────────────────

        private void UpdateRandomizeButton()
        {
            bool hasQuestType  = questType.SelectedItem   != null
                              && questLevel.SelectedValue != null;
            // Arena uses preset sets, so weapon/style filters don't gate the roll there.
            bool isArena       = questType.SelectedItem?.ToString()
                                    ?.Equals("Arena", StringComparison.OrdinalIgnoreCase) == true;
            bool hasWeapon     = isArena || _weaponPills.Any(p => p.Pill.IsChecked == true);
            bool hasStyle      = isArena || _stylePills.Any(p => p.Pill.IsChecked  == true);
            bool hasMonster    = monsterTreeView.SelectedNodes.Count > 0;
            bool biasOk        = prowlerPill.IsChecked != true
                              || new[] { chrPill, fghtPill, proPill, assPill,
                                         hlgPill, bmbPill, gthPill, bstPill }
                                 .Any(p => p.IsChecked == true);

            submitButton.IsEnabled = hasQuestType && hasWeapon && hasStyle && hasMonster && biasOk;
        }

        // Shared by both fromLevel and questLevel (Up to Level). Keeps From ≤ To:
        // raising From above To pushes To up; lowering To below From pulls From down.
        // Compared by list position since both bind the same ordered level list.
        private void QuestLevel_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            // Arena uses a single selector, so no From/To sync there.
            bool isArena = questType.SelectedItem?.ToString()
                              ?.Equals("Arena", StringComparison.OrdinalIgnoreCase) == true;
            if (!_syncingLevels && !isArena && fromLevel.SelectedIndex >= 0 && questLevel.SelectedIndex >= 0)
            {
                _syncingLevels = true;
                if (sender == fromLevel && fromLevel.SelectedIndex > questLevel.SelectedIndex)
                    questLevel.SelectedIndex = fromLevel.SelectedIndex;
                else if (sender == questLevel && questLevel.SelectedIndex < fromLevel.SelectedIndex)
                    fromLevel.SelectedIndex = questLevel.SelectedIndex;
                _syncingLevels = false;
            }
            UpdateRandomizeButton();
        }

        private void QuestType_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (sender is not ComboBox combo || combo.SelectedItem == null) return;

            var selection = combo.SelectedItem.ToString()!.ToLower();

            // Each case builds the full list from scratch.
            var levels = new List<QuestItem>();

            switch (selection)
            {
                case "village":
                    foreach (var (lbl, v) in new (string, int)[]
                        { ("1★",1),("2★",2),("3★",3),("4★",4),("5★",5),
                          ("6★",6),("7★",7),("8★",8),("9★",9),("10★",10),("10★ Advanced",11) })
                        levels.Add(new() { QuestLevel = lbl, QuestValue = v });
                    break;

                case "hub":
                    // Hub = Low/High Rank only (1★–8★ = L1–8). G Rank lives under Pub.
                    foreach (var (lbl, v) in new (string, int)[]
                        { ("1★",1),("2★",2),("3★",3),("4★",4),("5★",5),("6★",6),("7★",7),("8★",8) })
                        levels.Add(new() { QuestLevel = lbl, QuestValue = v });
                    break;

                case "pub":
                    foreach (var (lbl, v) in new (string, int)[]
                        { ("G1★",1),("G2★",2),("G3★",3),("G4★",4),("G4★ (HR13+)",5) })
                        levels.Add(new() { QuestLevel = lbl, QuestValue = v });
                    break;

                case "arena":
                    levels.Add(new() { QuestLevel = "All",       QuestValue = 0 });
                    levels.Add(new() { QuestLevel = "Normal",    QuestValue = 1 });
                    levels.Add(new() { QuestLevel = "Challenge", QuestValue = 2 });
                    break;

                case "special permits":
                    foreach (var (label, val) in new (string, int)[]
                    {
                        ("I",  1), ("II",  2), ("III", 3), ("IV", 4), ("V",  5),
                        ("VI", 6), ("VII", 7), ("VIII",8), ("IX", 9), ("X", 10),
                        ("G1",11), ("G2", 12), ("G3", 13), ("G4",14), ("G5",15),
                        ("EX",100),
                    })
                        levels.Add(new() { QuestLevel = label, QuestValue = val });
                    break;

                case "events":
                    levels.Add(new() { QuestLevel = "Low Rank",  QuestValue = 1 });
                    levels.Add(new() { QuestLevel = "High Rank", QuestValue = 2 });
                    levels.Add(new() { QuestLevel = "G Rank",    QuestValue = 3 });
                    break;
            }

            bool isArena = selection == "arena";
            _syncingLevels = true;
            fromLevel.ItemsSource   = levels;
            questLevel.ItemsSource  = levels;
            if (isArena)
            {
                // Arena is a single category pick (All/Normal/Challenge), not a range —
                // hide From Level and move the category selector under Quest Type.
                fromLevel.Visibility = Visibility.Collapsed;
                Microsoft.UI.Xaml.Controls.Grid.SetColumn(questLevel, 0);
                questLevel.Header = "Arena Type";
                fromLevel.SelectedIndex  = 0;
                questLevel.SelectedIndex = 0;   // default "All"
            }
            else
            {
                fromLevel.Visibility = Visibility.Visible;
                Microsoft.UI.Xaml.Controls.Grid.SetColumn(questLevel, 1);
                questLevel.Header = "Up to Level";
                fromLevel.SelectedIndex  = 0;                                      // lowest
                questLevel.SelectedIndex = levels.Count > 0 ? levels.Count - 1 : -1; // highest
            }
            _syncingLevels = false;
            UpdateRandomizeButton();
        }

        // ─── Monster tree: select/deselect children when species tapped ─────────

        private void MonsterTreeView_SelectionChanged(TreeView sender, TreeViewSelectionChangedEventArgs args)
        {
            if (_updatingTreeSelection) return;
            _updatingTreeSelection = true;
            try
            {
                // Species checked → check all its monsters
                foreach (TreeViewNode node in args.AddedItems.OfType<TreeViewNode>()
                                                             .Where(n => n.Children.Count > 0))
                {
                    foreach (TreeViewNode child in node.Children)
                        if (!sender.SelectedNodes.Contains(child))
                            sender.SelectedNodes.Add(child);
                }

                // Species unchecked → uncheck all its monsters, BUT only when the species
                // was explicitly clicked. When a single monster is unchecked, WinUI 3 also
                // auto-removes the parent from SelectedNodes in the same event; in that case
                // a leaf node will also be in RemovedItems and we must not cascade.
                bool leafRemoved = args.RemovedItems.OfType<TreeViewNode>()
                                                    .Any(n => n.Children.Count == 0);
                if (!leafRemoved)
                {
                    foreach (TreeViewNode node in args.RemovedItems.OfType<TreeViewNode>()
                                                                   .Where(n => n.Children.Count > 0))
                    {
                        foreach (TreeViewNode child in node.Children)
                            sender.SelectedNodes.Remove(child);
                    }
                }
            }
            finally
            {
                _updatingTreeSelection = false;
            }
            UpdateRandomizeButton();
            SaveSettings();
        }

        // ─── Submit / Randomize ─────────────────────────────────────────────────

        private async void SubmitButton_ClickAsync(object sender, RoutedEventArgs e)
        {
            if (questType.SelectedItem == null || questLevel.SelectedValue == null) return;

            int selectedLevel     = Convert.ToInt32(questLevel.SelectedValue);
            int selectedFromLevel = fromLevel.SelectedValue != null
                                        ? Convert.ToInt32(fromLevel.SelectedValue)
                                        : selectedLevel;
            string type = questType.SelectedItem.ToString()!;

            // Selected (checked) = included; build inclusion set from leaf nodes
            var includedMonsters = new HashSet<string>(
                monsterTreeView.SelectedNodes
                    .Where(n => n.Children.Count == 0)
                    .Select(n => (string)n.Content),
                StringComparer.OrdinalIgnoreCase);
            int totalLeafNodes = monsterTreeView.RootNodes.Sum(sn => sn.Children.Count);
            bool anyMonsterFiltered = includedMonsters.Count < totalLeafNodes;

            // Filter quest pool
            var pool = new List<Quest>();
            foreach (var q in _quests)
            {
                if (!q.Type.Equals(type, StringComparison.OrdinalIgnoreCase)) continue;

                // Special Permits: q.Level is the Deviant index, not the quest tier.
                // Parse the tier (I–G5–EX) from the quest name instead.
                if (type.Equals("Special Permits", StringComparison.OrdinalIgnoreCase))
                {
                    int tier = GetSpecialPermitTier(q.Name ?? "");
                    if (tier < selectedFromLevel || tier > selectedLevel) continue;
                }
                // Arena: single category pick — 0=All (everything), else exact level match
                // (1=Normal/Grudge Match, 2=Challenge/XX Trials).
                else if (type.Equals("Arena", StringComparison.OrdinalIgnoreCase))
                {
                    if (selectedLevel != 0 && q.Level != selectedLevel) continue;
                }
                else
                {
                    if (q.Level < selectedFromLevel || q.Level > selectedLevel) continue;
                }

                bool include = q.LgMonster
                    || (q.Prowler    && prowlerQuestsPill.IsChecked == true)
                    || (q.Hyper      && hyperPill.IsChecked == true)
                    || (q.Egg        && eggPill.IsChecked == true)
                    || (q.Gathering  && gatheringPill.IsChecked == true)
                    || (q.SmMonsters && smMonstersPill.IsChecked == true);

                if (!include) continue;

                // Hyper gate: most hyper quests are also large-monster quests (always
                // included), so without this they'd appear regardless of the toggle. When
                // Hypers is off, exclude hyper quests entirely.
                if (q.Hyper && hyperPill.IsChecked != true) continue;

                if (q.LgMonster && !string.IsNullOrEmpty(q.Monster) && anyMonsterFiltered)
                {
                    if (!includedMonsters.Contains(q.Monster)) continue;
                }

                pool.Add(q);
            }

            if (pool.Count == 0) pool.Add(new Quest());

            var quest = pool[Random.Shared.Next(pool.Count)];

            resultPlaceholder.Visibility = Visibility.Collapsed;
            resultContent.Visibility     = Visibility.Visible;

            questName.Text = quest.Name ?? "";
            questMain.Text = quest.Main ?? "";
            hyperBadge.Visibility   = quest.Hyper ? Visibility.Visible : Visibility.Collapsed;
            hyperOverlay.Visibility = quest.Hyper ? Visibility.Visible : Visibility.Collapsed;

            string baseDir = AppContext.BaseDirectory;
            // For Special Permits the Deviant is the true target; derive it from the quest name.
            string iconMonster = (type.Equals("Special Permits", StringComparison.OrdinalIgnoreCase)
                                  && !string.IsNullOrEmpty(quest.Name))
                ? GetSpecialPermitDeviant(quest.Name, quest.Monster)
                : quest.Monster ?? "";
            questTargetIcon.Source = LoadMonsterIcon(baseDir, iconMonster);

            // Arena quests use preset equipment sets (parsed from the quest description).
            // Hunter arenas offer a fixed weapon list; Prowler arenas a fixed bias list.
            // Roll within that set; style/arts are part of the set so we don't roll them.
            if (type.Equals("Arena", StringComparison.OrdinalIgnoreCase))
            {
                artsPanel.Visibility = Visibility.Collapsed;

                if (quest.ArenaBiases is { Count: > 0 })
                {
                    // Prowler arena: roll a bias from the set.
                    string bias = quest.ArenaBiases[Random.Shared.Next(quest.ArenaBiases.Count)];
                    weaponLabel.Text      = "Weapon";
                    weaponText.Text       = "Prowler";
                    weaponText.Foreground = new SolidColorBrush(WeaponColors["Prowler"]);
                    weaponIcon.Visibility = Visibility.Collapsed;
                    styleBlock.Visibility = Visibility.Visible;
                    styleLabel.Text       = "Bias";
                    styleText.Text        = bias;
                    styleIcon.Source      = BiasIcons.TryGetValue(bias, out var bf)
                                                ? LoadProwlerIcon(baseDir, bf) : null;
                    styleIcon.Opacity     = 1.0;
                }
                else if (quest.ArenaWeapons is { Count: > 0 })
                {
                    // Hunter arena: roll a weapon from the set.
                    string w = quest.ArenaWeapons[Random.Shared.Next(quest.ArenaWeapons.Count)];
                    weaponLabel.Text      = "Weapon";
                    weaponText.Text       = w;
                    weaponText.Foreground = WeaponColors.TryGetValue(w, out var wc2)
                        ? new SolidColorBrush(wc2)
                        : (Brush)Application.Current.Resources["TextFillColorPrimaryBrush"];
                    string? wp = LoadWeaponIconPath(baseDir, w);
                    if (wp != null) { weaponIcon.Source = new BitmapImage(new Uri(wp)); weaponIcon.Visibility = Visibility.Visible; }
                    else weaponIcon.Visibility = Visibility.Collapsed;
                    styleBlock.Visibility = Visibility.Collapsed;
                }
                else
                {
                    // No set data for this quest — fall back to a generic set number.
                    weaponLabel.Text      = "Loadout";
                    weaponText.Text       = "Set " + (Random.Shared.Next(5) + 1);
                    weaponText.Foreground = (Brush)Application.Current.Resources["TextFillColorPrimaryBrush"];
                    weaponIcon.Visibility = Visibility.Collapsed;
                    styleBlock.Visibility = Visibility.Collapsed;
                }
                return;
            }
            // Non-arena: restore the weapon/style layout in case the previous roll was Arena.
            weaponLabel.Text      = "Weapon";
            styleBlock.Visibility = Visibility.Visible;

            // Weapon roll. Prowler quests can only be undertaken by a Prowler, so the
            // weapon is forced to "Prowler" regardless of the weapon filter pills.
            string weapon;
            if (quest.Prowler)
            {
                weapon = "Prowler";
            }
            else
            {
                // Build available weapons (pill off = excluded)
                var excludedWeapons = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                foreach (var (pill, name) in _weaponPills)
                    if (pill.IsChecked != true) excludedWeapons.Add(name);

                var weapons = new List<string>
                {
                    "Great Sword","Long Sword","Sword & Shield","Dual Blades",
                    "Hammer","Hunting Horn","Lance","Gunlance","Switch Axe",
                    "Charge Blade","Insect Glaive","Light Bowgun","Heavy Bowgun","Bow"
                };
                if (prowlerPill.IsChecked == true) weapons.Add("Prowler");

                weapons.RemoveAll(w => excludedWeapons.Contains(w));
                if (weapons.Count == 0) weapons.Add("Great Sword");

                weapon = weapons[Random.Shared.Next(weapons.Count)];

                // Reroll weapon if the blacklist blocks every available style for it
                if (_blacklist.Count > 0)
                {
                    var baseStyles = new List<string> { "Guild","Striker","Adept","Aerial","Valor","Alchemy" };
                    foreach (var (pill, name) in _stylePills)
                        if (pill.IsChecked != true) baseStyles.Remove(name);
                    for (int t = 0; t < 50; t++)
                    {
                        var blS = new HashSet<string>(
                            _blacklist.Where(b => b.Weapon.Equals(weapon, StringComparison.OrdinalIgnoreCase))
                                      .Select(b => b.Style), StringComparer.OrdinalIgnoreCase);
                        if (baseStyles.Any(s => !blS.Contains(s))) break;
                        weapon = weapons[Random.Shared.Next(weapons.Count)];
                    }
                }
            }
            weaponText.Text = weapon;
            weaponText.Foreground = WeaponColors.TryGetValue(weapon, out var wc)
                ? new SolidColorBrush(wc)
                : (Brush)Application.Current.Resources["TextFillColorPrimaryBrush"];
            string? wIconPath = LoadWeaponIconPath(baseDir, weapon);
            if (wIconPath != null)
            {
                weaponIcon.Source     = new BitmapImage(new Uri(wIconPath));
                weaponIcon.Visibility = Visibility.Visible;
            }
            else
            {
                weaponIcon.Visibility = Visibility.Collapsed;
            }

            if (weapon == "Prowler")
            {
                var biases = new List<(string Name, string IconFile)>
                {
                    ("Charisma",   "FourthGen-Palico_Icon_Blue.webp"),
                    ("Fighting",   "Palico_Weapon_Cutting_Icon_Red.webp"),
                    ("Protection", "FourthGen-Down_Arrow_Icon_Blue.webp"),
                    ("Assisting",  "MH4G-Trap_Icon_Purple.webp"),
                    ("Healing",    "MH4G-Horn_Icon_Green.webp"),
                    ("Bombing",    "MH4G-Barrel_Icon_Brown.webp"),
                    ("Gathering",  "MH4G-Boomerang_Icon_Blue.webp"),
                    ("Beast",      "FourthGen-Claw_Icon_Dark_Red.webp"),
                };

                if (chrPill.IsChecked  != true) biases.RemoveAll(b => b.Name == "Charisma");
                if (fghtPill.IsChecked != true) biases.RemoveAll(b => b.Name == "Fighting");
                if (proPill.IsChecked  != true) biases.RemoveAll(b => b.Name == "Protection");
                if (assPill.IsChecked  != true) biases.RemoveAll(b => b.Name == "Assisting");
                if (hlgPill.IsChecked  != true) biases.RemoveAll(b => b.Name == "Healing");
                if (bmbPill.IsChecked  != true) biases.RemoveAll(b => b.Name == "Bombing");
                if (gthPill.IsChecked  != true) biases.RemoveAll(b => b.Name == "Gathering");
                if (bstPill.IsChecked  != true) biases.RemoveAll(b => b.Name == "Beast");

                if (biases.Count == 0) biases.Add(("Charisma", "FourthGen-Palico_Icon_Blue.webp"));

                var (biasName, biasIcon) = biases[Random.Shared.Next(biases.Count)];
                styleLabel.Text = "Bias";
                styleText.Text  = biasName;
                styleIcon.Source = LoadProwlerIcon(baseDir, biasIcon);
                styleIcon.Opacity = 1.0;
                artsPanel.Visibility = Visibility.Collapsed;
            }
            else
            {
                // Build available styles (pill off = excluded)
                var excludedStyles = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                foreach (var (pill, name) in _stylePills)
                    if (pill.IsChecked != true) excludedStyles.Add(name);

                var styles = new List<string> { "Guild","Striker","Adept","Aerial","Valor","Alchemy" };
                styles.RemoveAll(s => excludedStyles.Contains(s));
                // Apply blacklist: remove styles paired with this weapon
                var blStyles = new HashSet<string>(
                    _blacklist.Where(b => b.Weapon.Equals(weapon, StringComparison.OrdinalIgnoreCase))
                              .Select(b => b.Style), StringComparer.OrdinalIgnoreCase);
                var filteredStyles = styles.Where(s => !blStyles.Contains(s)).ToList();
                if (filteredStyles.Count > 0) styles = filteredStyles;
                if (styles.Count == 0) styles.Add("Guild");

                string style = styles[Random.Shared.Next(styles.Count)];
                styleLabel.Text = "Style";
                styleText.Text  = style;
                styleIcon.Opacity = 0.0;
                artsPanel.Visibility = Visibility.Visible;

                hunterArt1.Text = "";
                hunterArt2.Text = "";
                hunterArt3.Text = "";

                // Arts the user filtered out (unchecked leaves in the Hunter Arts tree)
                var excludedArts = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                foreach (TreeViewNode w in artTreeView.RootNodes) CollectExcludedArts(w, excludedArts);

                string? s1 = null, s2 = null, s3 = null;
                switch (style)
                {
                    case "Striker":
                    case "Alchemy":
                        s1 = RollArt(weapon, null, null, excludedArts);
                        s2 = RollArt(weapon, s1,   null, excludedArts);
                        s3 = RollArt(weapon, s1,   s2,   excludedArts);
                        break;
                    case "Guild":
                        s1 = RollArt(weapon, null, null, excludedArts);
                        s2 = RollArt(weapon, s1, null, excludedArts);
                        break;
                    case "Valor":
                    case "Adept":
                    case "Aerial":
                        s1 = RollArt(weapon, null, null, excludedArts);
                        break;
                    default:
                        s1 = RollArt(weapon, null, null, excludedArts);
                        break;
                }

                hunterArt1.Text = MaybeSP(s1);
                hunterArt2.Text = MaybeSP(s2);
                hunterArt3.Text = MaybeSP(s3);
            }

            await Task.CompletedTask;
        }

        // ─── Hunter art rolling ─────────────────────────────────────────────────

        private static string MaybeSP(string? art)
        {
            if (string.IsNullOrEmpty(art)) return "";
            return Random.Shared.NextDouble() < 1.0 / 3.0 ? art + " [SP]" : art;
        }

        // Strip a trailing level suffix (" I"/" II"/" III") so e.g. "Haste Rain I" and
        // "Haste Rain III" compare equal — you can't equip the same art at two levels.
        private static string ArtBase(string name) =>
            System.Text.RegularExpressions.Regex.Replace(name, @" (III|II|I)$", "");

        private string? RollArt(string weapon, string? exclude1, string? exclude2, HashSet<string> excludedArts)
        {
            string? b1 = exclude1 != null ? ArtBase(exclude1) : null;
            string? b2 = exclude2 != null ? ArtBase(exclude2) : null;
            for (int attempt = 0; attempt < 1000; attempt++)
            {
                var art = _arts[Random.Shared.Next(_arts.Count)];
                if (excludedArts.Contains(art.HunterArtName)) continue;   // filtered out by the user
                if (!art.Weapon.Equals("All", StringComparison.OrdinalIgnoreCase)
                    && !art.Weapon.Equals(weapon, StringComparison.OrdinalIgnoreCase)) continue;
                string b = ArtBase(art.HunterArtName);
                if (b == b1 || b == b2) continue;
                return art.HunterArtName;
            }
            return null;
        }

        // ─── Settings ──────────────────────────────────────────────────────────

        private static string SettingsFilePath =>
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                         "MHGU Quest Randomizer", "settings.json");

        private AppSettings LoadSettings()
        {
            try
            {
                if (File.Exists(SettingsFilePath))
                    return JsonSerializer.Deserialize<AppSettings>(File.ReadAllText(SettingsFilePath), SettingsJsonOpts) ?? new();
            }
            catch { }
            return new();
        }

        private void SaveSettings()
        {
            if (_loadingSettings) return;
            try
            {
                var excArts = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                foreach (TreeViewNode w in artTreeView.RootNodes) CollectExcludedArts(w, excArts);

                var s = new AppSettings
                {
                    ThemeColor = $"#{_pillColor.R:X2}{_pillColor.G:X2}{_pillColor.B:X2}",
                    ExWeapons  = _weaponPills.Where(p => p.Pill.IsChecked != true).Select(p => p.Name).ToList(),
                    ExStyles   = _stylePills.Where(p => p.Pill.IsChecked != true).Select(p => p.Name).ToList(),
                    ExBiases   = _biasPills.Where(p => p.Pill.IsChecked != true).Select(p => p.Name).ToList(),
                    ExMonsters = CollectUncheckedMonsters(),
                    ExArts     = excArts.ToList(),
                    Blacklist  = _blacklist.ToList(),
                    Hyper = hyperPill.IsChecked == true,
                    Egg = eggPill.IsChecked == true,
                    Gathering = gatheringPill.IsChecked == true,
                    SmMonsters = smMonstersPill.IsChecked == true,
                    Prowler = prowlerPill.IsChecked == true,
                    ProwlerQuests = prowlerQuestsPill.IsChecked == true,
                };
                Directory.CreateDirectory(Path.GetDirectoryName(SettingsFilePath)!);
                File.WriteAllText(SettingsFilePath, JsonSerializer.Serialize(s, SettingsJsonOpts));
            }
            catch { }
        }

        private List<string> CollectUncheckedMonsters()
        {
            var list = new List<string>();
            foreach (TreeViewNode sp in monsterTreeView.RootNodes)
                foreach (TreeViewNode leaf in sp.Children)
                    if (!monsterTreeView.SelectedNodes.Contains(leaf))
                        list.Add((string)leaf.Content);
            return list;
        }

        private void InitPillColor()
        {
            _loadedSettings ??= LoadSettings();
            Color color;
            try { color = Hex(_loadedSettings.ThemeColor); } catch { color = Hex("#4A4A4A"); }
            _pillColor = color;
            ApplyPillColor(color);
        }

        // Apply the saved filter selections to the controls/trees. Guarded so the change
        // handlers don't re-save mid-load.
        private void ApplyLoadedFilters()
        {
            var s = _loadedSettings ??= LoadSettings();
            _loadingSettings = true;
            try
            {
                void ApplyPills((CheckBox Pill, string Name)[] pills, List<string> excluded)
                {
                    var ex = new HashSet<string>(excluded, StringComparer.OrdinalIgnoreCase);
                    foreach (var (pill, name) in pills) pill.IsChecked = !ex.Contains(name);
                }
                ApplyPills(_weaponPills, s.ExWeapons);
                ApplyPills(_stylePills,  s.ExStyles);
                ApplyPills(_biasPills,   s.ExBiases);

                hyperPill.IsChecked      = s.Hyper;
                eggPill.IsChecked        = s.Egg;
                gatheringPill.IsChecked  = s.Gathering;
                smMonstersPill.IsChecked = s.SmMonsters;
                prowlerPill.IsChecked    = s.Prowler;
                prowlerQuestsPill.IsEnabled = s.Prowler;
                prowlerQuestsPill.IsChecked = s.Prowler && s.ProwlerQuests;

                // Monsters: deselect saved-unchecked leaves, then deselect any species not fully selected.
                if (s.ExMonsters.Count > 0)
                {
                    var ex = new HashSet<string>(s.ExMonsters, StringComparer.OrdinalIgnoreCase);
                    _updatingTreeSelection = true;
                    foreach (TreeViewNode sp in monsterTreeView.RootNodes)
                    {
                        foreach (TreeViewNode leaf in sp.Children)
                            if (ex.Contains((string)leaf.Content))
                                monsterTreeView.SelectedNodes.Remove(leaf);
                        if (sp.Children.Any(c => !monsterTreeView.SelectedNodes.Contains(c)))
                            monsterTreeView.SelectedNodes.Remove(sp);
                    }
                    _updatingTreeSelection = false;
                }

                // Arts: deselect saved-unchecked leaves, then fix parent selection bottom-up.
                if (s.ExArts.Count > 0)
                {
                    var ex = new HashSet<string>(s.ExArts, StringComparer.OrdinalIgnoreCase);
                    _updatingArtSelection = true;
                    foreach (TreeViewNode w in artTreeView.RootNodes) DeselectArtLeaves(w, ex);
                    foreach (TreeViewNode w in artTreeView.RootNodes) FixArtParentSelection(w);
                    _updatingArtSelection = false;
                }

                // Blacklist
                if (s.Blacklist.Count > 0)
                {
                    _blacklist = s.Blacklist;
                    RenderBlacklist();
                }
            }
            finally { _loadingSettings = false; }
        }

        private void DeselectArtLeaves(TreeViewNode node, HashSet<string> excluded)
        {
            if (node.Children.Count == 0)
            {
                if (excluded.Contains((string)node.Content)) artTreeView.SelectedNodes.Remove(node);
            }
            else
                foreach (TreeViewNode c in node.Children) DeselectArtLeaves(c, excluded);
        }

        private void FixArtParentSelection(TreeViewNode node)
        {
            foreach (TreeViewNode c in node.Children) FixArtParentSelection(c);
            if (node.Children.Count > 0 && node.Children.Any(c => !artTreeView.SelectedNodes.Contains(c)))
                artTreeView.SelectedNodes.Remove(node);
        }

        private async void SetAppIcon(string baseDir)
        {
            try
            {
                string webp = Path.Combine(baseDir, "Assets", "MonsterIcons",
                                           "MHGU-Question_Mark_Icon.webp");
                if (!File.Exists(webp)) return;

                string png = Path.Combine(Path.GetTempPath(), "mhgu_app_icon.png");
                string ico = Path.Combine(Path.GetTempPath(), "mhgu_app_icon.ico");

                // Convert webp → PNG on thread-pool (WIC async ops deadlock on UI thread)
                if (!File.Exists(png))
                {
                    await Task.Run(async () =>
                    {
                        using var inS  = File.OpenRead(webp);
                        using var outS = File.Create(png);
                        var dec = await Windows.Graphics.Imaging.BitmapDecoder
                            .CreateAsync(inS.AsRandomAccessStream());
                        var bmp = await dec.GetSoftwareBitmapAsync();
                        var enc = await Windows.Graphics.Imaging.BitmapEncoder
                            .CreateAsync(Windows.Graphics.Imaging.BitmapEncoder.PngEncoderId,
                                         outS.AsRandomAccessStream());
                        enc.SetSoftwareBitmap(bmp);
                        await enc.FlushAsync();
                    });
                }

                // Wrap PNG bytes in a minimal ICO container — AppWindow.SetIcon
                // reliably accepts ICO on both packaged and unpackaged apps.
                if (!File.Exists(ico))
                {
                    byte[] pngBytes = File.ReadAllBytes(png);
                    using var w = new BinaryWriter(File.Create(ico));
                    w.Write((ushort)0);               // ICONDIR reserved
                    w.Write((ushort)1);               // type = ICO
                    w.Write((ushort)1);               // image count
                    w.Write((byte)0);                 // width  (0 = PNG embedded)
                    w.Write((byte)0);                 // height
                    w.Write((byte)0);                 // color count
                    w.Write((byte)0);                 // reserved
                    w.Write((ushort)1);               // planes
                    w.Write((ushort)32);              // bit count
                    w.Write((uint)pngBytes.Length);   // data size
                    w.Write((uint)22);                // data offset (6+16)
                    w.Write(pngBytes);
                }

                AppWindow.SetIcon(ico);

                // Also show in the custom title bar Image (displays at 36×36 DIPs)
                titleBarIcon.Source = new BitmapImage(new Uri(webp));
            }
            catch { }
        }

        private void ResetFilters_Click(object sender, RoutedEventArgs e)
        {
            // Quest filters — all OFF by default
            gatheringPill.IsChecked  = false;
            smMonstersPill.IsChecked = false;
            hyperPill.IsChecked      = false;
            eggPill.IsChecked        = false;

            // Prowler — OFF by default
            prowlerPill.IsChecked       = false;
            prowlerQuestsPill.IsChecked = false;

            // Biases — all ON
            chrPill.IsChecked  = true;
            fghtPill.IsChecked = true;
            proPill.IsChecked  = true;
            assPill.IsChecked  = true;
            hlgPill.IsChecked  = true;
            bmbPill.IsChecked  = true;
            gthPill.IsChecked  = true;
            bstPill.IsChecked  = true;

            // Weapons — all ON
            foreach (var (pill, _) in _weaponPills)
                pill.IsChecked = true;

            // Styles — all ON
            foreach (var (pill, _) in _stylePills)
                pill.IsChecked = true;

            // Monsters — re-select all (all included by default)
            _updatingTreeSelection = true;
            var toDeselect = monsterTreeView.SelectedNodes.ToList();
            foreach (var node in toDeselect)
                monsterTreeView.SelectedNodes.Remove(node);
            foreach (TreeViewNode speciesNode in monsterTreeView.RootNodes)
            {
                monsterTreeView.SelectedNodes.Add(speciesNode);
                foreach (TreeViewNode child in speciesNode.Children)
                    monsterTreeView.SelectedNodes.Add(child);
            }
            _updatingTreeSelection = false;

            // Hunter Arts — re-select all
            _updatingArtSelection = true;
            foreach (var node in artTreeView.SelectedNodes.ToList())
                artTreeView.SelectedNodes.Remove(node);
            foreach (TreeViewNode w in artTreeView.RootNodes)
                SelectNodeTree(w);
            _updatingArtSelection = false;

            // Blacklist — clear
            _blacklist.Clear();
            RenderBlacklist();

            SaveSettings();   // persist the fully-reset state
        }

        private async void HelpButton_Click(object sender, RoutedEventArgs e)
        {
            var secondary = (Brush)Application.Current.Resources["TextFillColorSecondaryBrush"];
            var panel = new StackPanel { Spacing = 10, Width = 360 };

            void Step(string head, string body)
            {
                var tb = new TextBlock { TextWrapping = TextWrapping.Wrap };
                tb.Inlines.Add(new Microsoft.UI.Xaml.Documents.Run { Text = head + "  ", FontWeight = Microsoft.UI.Text.FontWeights.SemiBold });
                tb.Inlines.Add(new Microsoft.UI.Xaml.Documents.Run { Text = body });
                panel.Children.Add(tb);
            }

            Step("1. Pick a quest type & level.", "Choose a Quest Type, then the From / Up to Level range. (Arena uses a single All / Normal / Challenge picker instead of a range.)");
            Step("2. Narrow the pool with the filters.", "Quest Filters add categories (large-monster quests are always in; check Hypers / Egg Delivery / Gathering / Small Monsters). Monsters, Weapons and Styles: uncheck to exclude. Hunter Arts: uncheck by weapon, named art, or level. Restrictions: add weapon + style combos that will never be rolled together. Prowler: enable to allow Palico loadouts and Prowler-only quests, with biases for the roll.");
            Step("3. Press Randomize!", "You get a quest plus a weapon, style, and Hunter Arts. Arena quests show which preset Set to bring; Prowler quests give a bias; Hyper quests show a yellow Hyper badge.");
            panel.Children.Add(new TextBlock
            {
                Text = "Your filters and color theme are saved between sessions. Use Reset Filters to start over.",
                TextWrapping = TextWrapping.Wrap,
                Foreground = secondary,
            });

            var dialog = new ContentDialog
            {
                Title = "How to use",
                CloseButtonText = "Close",
                XamlRoot = Content.XamlRoot,
                Content = new ScrollViewer { Content = panel, MaxHeight = 420 },
            };
            await dialog.ShowAsync();
        }

        private async void AboutButton_Click(object sender, RoutedEventArgs e)
        {
            var secondary = (Brush)Application.Current.Resources["TextFillColorSecondaryBrush"];
            var panel = new StackPanel { Spacing = 8, Width = 340 };
            panel.Children.Add(new TextBlock { Text = "An unofficial, non-commercial fan tool. The original prototype was hand-built by the author and refined with Claude (Claude Code).", TextWrapping = TextWrapping.Wrap });
            panel.Children.Add(new TextBlock { Text = "Quest data: Kiranico (mhgu.kiranico.com)", TextWrapping = TextWrapping.Wrap });
            panel.Children.Add(new TextBlock { Text = "Icons: monsterhunter.fandom.com", TextWrapping = TextWrapping.Wrap });
            panel.Children.Add(new TextBlock { Text = "Hyper UI icon: monsterhunterwiki.org", TextWrapping = TextWrapping.Wrap });
            panel.Children.Add(new TextBlock
            {
                Text = "Monster Hunter content is owned by Capcom. This tool is not affiliated with or endorsed by Capcom.",
                TextWrapping = TextWrapping.Wrap,
                Foreground = secondary,
            });

            var dialog = new ContentDialog
            {
                Title = "About / Attributions",
                CloseButtonText = "Close",
                XamlRoot = Content.XamlRoot,
                Content = panel,
            };
            await dialog.ShowAsync();
        }

        private async void SettingsButton_Click(object sender, RoutedEventArgs e)
        {
            var panel = new StackPanel { Spacing = 16, Width = 240 };

            // ── Scale ──────────────────────────────────────────────────────
            int currentPct = (int)Math.Round(_uiScale * 100);
            var scaleCombo = new ComboBox { Header = "UI Scale", Width = 160 };
            foreach (var pct in new[] { 100, 125, 150, 175, 200 })
                scaleCombo.Items.Add($"{pct}%");
            scaleCombo.SelectedItem = $"{currentPct}%";
            if (scaleCombo.SelectedIndex == -1) scaleCombo.SelectedIndex = 0;
            panel.Children.Add(scaleCombo);

            // ── Color ──────────────────────────────────────────────────────
            // Named after MHGU monsters that evoke each hue (icon shown on each swatch).
            var namedColors = new (string Name, Color Value)[]
            {
                ("Teostra",       Hex("#922B21")),
                ("Rathalos",      Hex("#E74C3C")),
                ("Tigrex",        Hex("#E67E22")),
                ("Akantor",       Hex("#F39C12")),
                ("Rajang",        Hex("#F1C40F")),
                ("Rathian",       Hex("#27AE60")),
                ("Zinogre",       Hex("#1ABC9C")),
                ("Lagiacrus",     Hex("#3498DB")),
                ("Brachydios",    Hex("#2980B9")),
                ("Gore Magala",   Hex("#5C6BC0")),
                ("Chameleos",     Hex("#9B59B6")),
                ("Mizutsune",     Hex("#D81B60")),
                ("Amatsu",        Hex("#FFFFFF")),
                ("Kushala Daora", Hex("#BDC3C7")),
                ("Ukanlos",       Hex("#95A5A6")),
                ("Nargacuga",     Hex("#4A4A4A")),
            };

            var colorCombo = new ComboBox { Header = "Background Color", Width = 200 };
            ComboBoxItem? matchItem = null;

            string iconBase = AppContext.BaseDirectory;
            foreach (var (name, color) in namedColors)
            {
                var swatch = new Border
                {
                    Width = 28, Height = 28,
                    Background    = new SolidColorBrush(color),
                    CornerRadius  = new CornerRadius(4),
                    VerticalAlignment = VerticalAlignment.Center,
                    Child = new Image
                    {
                        Source  = LoadMonsterIcon(iconBase, name),
                        Stretch = Stretch.Uniform,
                        Margin  = new Thickness(1),
                    },
                };
                var row = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 10 };
                row.Children.Add(swatch);
                row.Children.Add(new TextBlock
                {
                    Text = name,
                    VerticalAlignment = VerticalAlignment.Center,
                });

                var item = new ComboBoxItem { Content = row, Tag = color };
                colorCombo.Items.Add(item);

                if (color.R == _pillColor.R && color.G == _pillColor.G && color.B == _pillColor.B)
                    matchItem = item;
            }

            colorCombo.SelectedItem = matchItem ?? colorCombo.Items[0];
            panel.Children.Add(colorCombo);

            // ── Dialog ─────────────────────────────────────────────────────
            var dialog = new ContentDialog
            {
                Title = "Settings",
                PrimaryButtonText = "Apply",
                CloseButtonText = "Cancel",
                DefaultButton = ContentDialogButton.Primary,
                XamlRoot = Content.XamlRoot,
                Content = panel,
            };

            if (await dialog.ShowAsync() == ContentDialogResult.Primary)
            {
                if (scaleCombo.SelectedItem is string scaleStr)
                    ApplyScale(int.Parse(scaleStr.TrimEnd('%')) / 100.0);

                if (colorCombo.SelectedItem is ComboBoxItem ci && ci.Tag is Color chosenColor)
                {
                    ApplyPillColor(chosenColor);
                    SaveSettings();
                }
            }
        }

        private void ApplyScale(double scale)
        {
            _uiScale = scale;
            ResizeWindow(scale);
        }

        [DllImport("user32.dll")]
        private static extern bool GetClientRect(IntPtr hwnd, out RECT lpRect);

        [StructLayout(LayoutKind.Sequential)]
        private struct RECT { public int Left, Top, Right, Bottom; }

        private void ResizeWindow(double scale)
        {
            double dpi = Content.XamlRoot?.RasterizationScale ?? 1.0;

            // Measure the actual non-client overhead (title bar + borders) by comparing
            // the current outer window size to the current client area in physical pixels.
            IntPtr hwnd = WinRT.Interop.WindowNative.GetWindowHandle(this);
            GetClientRect(hwnd, out var cr);
            int ncW = AppWindow.Size.Width  - (cr.Right  - cr.Left);
            int ncH = AppWindow.Size.Height - (cr.Bottom - cr.Top);

            // appTitleBar (48 DIPs) is outside the Viewbox — scales with DPI only, not UI scale.
            AppWindow.Resize(new SizeInt32(
                (int)(BaseWindowWidth  * scale * dpi) + ncW,
                (int)(BaseWindowHeight * scale * dpi) + (int)Math.Round(48 * dpi) + ncH));

            if (AppWindow.Presenter is OverlappedPresenter p)
            {
                p.IsResizable   = false;
                p.IsMaximizable = false;
            }
        }

        private void ApplyPillColor(Color color)
        {
            _pillColor = color;

            // Background: very dark tint of the chosen color
            var bg      = Darken(color, 0.18); bg.A      = 255;
            var hover   = Darken(color, 0.24); hover.A   = 255;
            var pressed = Darken(color, 0.13); pressed.A = 255;
            _backgroundBrush.Color = bg;

            // Accent: theme color lightened toward white for interactive elements
            var accent        = Lighten(color, 0.20);
            var accentHover   = Lighten(color, 0.38);
            var accentPressed = Lighten(color, 0.08);
            var accentDisabled = Color.FromArgb(100, accent.R, accent.G, accent.B);

            // Mutate persistent brushes — controls in Checked state update immediately
            // without needing a hover/state transition (no stale object reference).
            _btnBg.Color          = accent;
            _btnBgHover.Color     = accentHover;
            _btnBgPress.Color     = accentPressed;
            _btnBgDisable.Color   = accentDisabled;
            _btnBorder.Color      = accent;
            _btnBorderHover.Color = accentHover;
            _btnBorderPress.Color = accentPressed;
            _cbFill.Color         = accent;
            _cbFillHover.Color    = accentHover;
            _cbFillPress.Color    = accentPressed;
            _cbFillDisable.Color  = accentDisabled;
            _cbStroke.Color       = accent;
            _cbStrokeHover.Color  = accentHover;
            _cbStrokePress.Color  = accentPressed;

            _titleBarBrush.Color = bg;

            // Close/min/max button colors (still controlled via TitleBar API)
            var tb = AppWindow.TitleBar;
            var white    = Color.FromArgb(255, 255, 255, 255);
            var dimWhite = Color.FromArgb(255, 160, 160, 160);
            tb.ButtonBackgroundColor          = bg;
            tb.ButtonForegroundColor          = white;
            tb.ButtonHoverBackgroundColor     = hover;
            tb.ButtonHoverForegroundColor     = white;
            tb.ButtonPressedBackgroundColor   = pressed;
            tb.ButtonPressedForegroundColor   = white;
            tb.ButtonInactiveBackgroundColor  = bg;
            tb.ButtonInactiveForegroundColor  = dimWhite;

            // Mica only shows through a transparent background.
            SystemBackdrop = null;
        }

        // "Grimclaw IV: Hunt" → 4   "Soulseer G3: Hunt" → 13   "Bloodbath EX: Hunt" → 100
        private static int GetSpecialPermitTier(string name)
        {
            int c = name.IndexOf(':');
            if (c < 1) return 0;
            int s = name.LastIndexOf(' ', c - 1);
            if (s < 0) return 0;
            return name[(s + 1)..c] switch
            {
                "I"    => 1,  "II"   => 2,  "III"  => 3,  "IV"   => 4,
                "V"    => 5,  "VI"   => 6,  "VII"  => 7,  "VIII" => 8,
                "IX"   => 9,  "X"    => 10, "G1"   => 11, "G2"   => 12,
                "G3"   => 13, "G4"   => 14, "G5"   => 15, "EX"   => 100,
                _      => 0,
            };
        }

        // "Grimclaw IV: Hunt" → "Grimclaw Tigrex"  |  "Crystalbeard G5: Hunt" (Monster=Raging Brachydios) → "Crystalbeard Uragaan"
        private static string GetSpecialPermitDeviant(string name, string? monster)
        {
            // The part before ": " is "Deviant TIER"; drop the tier word to get the Deviant prefix.
            int c = name.IndexOf(':');
            if (c > 0)
            {
                int s = name.LastIndexOf(' ', c - 1);
                if (s > 0)
                {
                    string deviantPrefix = name[..s]; // e.g. "Crystalbeard"
                    // Monster field is already the full Deviant name — use it directly.
                    if (!string.IsNullOrEmpty(monster) &&
                        monster.StartsWith(deviantPrefix, StringComparison.OrdinalIgnoreCase))
                        return monster;
                    // Monster is a non-Deviant sub-quest target — resolve full name from lookup.
                    if (DeviantFullNames.TryGetValue(deviantPrefix, out string? fullName))
                        return fullName;
                }
            }
            return monster ?? "";
        }

        private static Color Darken(Color c, double factor) =>
            Color.FromArgb(c.A,
                (byte)Math.Max(0, Math.Min(255, c.R * factor)),
                (byte)Math.Max(0, Math.Min(255, c.G * factor)),
                (byte)Math.Max(0, Math.Min(255, c.B * factor)));

        private static Color Lighten(Color c, double whiteBlend) =>
            Color.FromArgb(255,
                (byte)(c.R + (255 - c.R) * whiteBlend),
                (byte)(c.G + (255 - c.G) * whiteBlend),
                (byte)(c.B + (255 - c.B) * whiteBlend));


        // ─── Icon loading ───────────────────────────────────────────────────────

        private static string? LoadWeaponIconPath(string baseDir, string weaponName)
        {
            if (weaponName == "Prowler") return null;
            string stem = "icon_" + weaponName.ToLower()
                                               .Replace(" & ", "_and_")
                                               .Replace(" ", "_");
            string tinted = Path.Combine(baseDir, "Assets", "WeaponIcons", stem + "_tinted.png");
            if (File.Exists(tinted)) return tinted;
            string plain = Path.Combine(baseDir, "Assets", "WeaponIcons", stem + ".png");
            return File.Exists(plain) ? plain : null;
        }

        private BitmapImage? LoadMonsterIcon(string baseDir, string? monsterName)
        {
            string fallback = Path.Combine(baseDir, "Assets", "MonsterIcons", "MHGU-Question_Mark_Icon.webp");
            if (string.IsNullOrWhiteSpace(monsterName))
                return File.Exists(fallback) ? new BitmapImage(new Uri(fallback)) : null;

            string file = "MHGU-" + monsterName.Replace(" ", "_") + "_Icon.webp";
            string path = Path.Combine(baseDir, "Assets", "MonsterIcons", file);
            if (File.Exists(path)) return new BitmapImage(new Uri(path));
            return File.Exists(fallback) ? new BitmapImage(new Uri(fallback)) : null;
        }

        private BitmapImage? LoadProwlerIcon(string baseDir, string fileName)
        {
            string path = Path.Combine(baseDir, "Assets", "ProwlerIcons", fileName);
            return File.Exists(path) ? new BitmapImage(new Uri(path)) : null;
        }
    }
}
