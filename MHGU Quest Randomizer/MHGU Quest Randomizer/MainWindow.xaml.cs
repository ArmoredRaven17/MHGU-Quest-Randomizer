using Microsoft.Build.Tasks.Deployment.Bootstrapper;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Controls.Primitives;
using Microsoft.UI.Xaml.Data;
using Microsoft.UI.Xaml.Input;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI.Xaml.Navigation;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices.WindowsRuntime;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Windows.ApplicationModel.VoiceCommands;
using Windows.Devices.AllJoyn;
using Windows.Foundation;
using Windows.Foundation.Collections;
using Windows.Media.Protection;
using static MHGU_Quest_Randomizer.MainWindow;
using static System.Collections.Specialized.BitVector32;

// To learn more about WinUI, the WinUI project structure,
// and more about our project templates, see: http://aka.ms/winui-project-info.

namespace MHGU_Quest_Randomizer
{
    /// <summary>
    /// An empty window that can be used on its own or navigated to within a Frame.
    /// </summary>
    public sealed partial class MainWindow : Window
    {
        public List<Quest> quests = new List<Quest>();
        private List<HunterArt> arts = new List<HunterArt>();
        public string slot1 = "none";
        public string slot2 = "none";
        public string slot3 { get; set; }
        public MainWindow()
        {
            InitializeComponent();
            string filePath = "C:\\Coding Repos\\MHGU Quest Randomizer\\QuestData.json";
            string jsonString = File.ReadAllText(filePath);
            quests = JsonSerializer.Deserialize<List<Quest>>(jsonString, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            filePath = "C:\\Coding Repos\\MHGU Quest Randomizer\\Hunter Arts.json";
            jsonString = File.ReadAllText(filePath);
            arts = JsonSerializer.Deserialize<List<HunterArt>>(jsonString, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });
        }
        private class QuestItem
        {
            public string QuestLevel {  get; set; }
            public int QuestValue { get; set; }
        }
        private class HunterArt
        {
            public string HunterArtName { get; set; }
            public string Weapon { get; set; }
        }

        private void QuestType_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            Debug.WriteLine("Selection Changed to " + sender.ToString());
            if (sender != null)
            {
                ComboBox combo = sender as ComboBox;

                if (combo.SelectedValue != null)
                {
                    var selection = combo.SelectedValue.ToString().ToLower();
                    var questItemsBase = new List<QuestItem>
                    {
                        new QuestItem {QuestLevel = "1*", QuestValue = 1 },
                        new QuestItem {QuestLevel = "2*", QuestValue = 2 },
                        new QuestItem {QuestLevel = "3*", QuestValue = 3 },
                        new QuestItem {QuestLevel = "4*", QuestValue = 4 },
                        new QuestItem {QuestLevel = "5*", QuestValue = 5 },
                        new QuestItem {QuestLevel = "6*", QuestValue = 6 },
                        new QuestItem {QuestLevel = "7*", QuestValue = 7 },
                        new QuestItem {QuestLevel = "8*", QuestValue = 8 }
                    };
                    //Village, Hub and G Rank all have 1-8*
                    if (selection == "pub")
                    {
                        //Only Hub has G star levels (Deviants use G# not stars)
                        questItemsBase.Add(new QuestItem { QuestLevel = "G1*", QuestValue = 9 });
                        questItemsBase.Add(new QuestItem { QuestLevel = "G2*", QuestValue = 10 });
                        questItemsBase.Add(new QuestItem { QuestLevel = "G3*", QuestValue = 11 });
                        questItemsBase.Add(new QuestItem { QuestLevel = "G4*", QuestValue = 12 });
                        questItemsBase.Add(new QuestItem { QuestLevel = "G4* (HR13+)", QuestValue = 13 });
                    }
                    if(selection == "village")
                    {
                        //Village is unique in that it has 9* and 10* 
                        questItemsBase.Add(new QuestItem { QuestLevel = "9*", QuestValue = 9 });
                        questItemsBase.Add(new QuestItem { QuestLevel = "10*", QuestValue = 10 });
                        questItemsBase.Add(new QuestItem { QuestLevel = "10* Advanced", QuestValue = 11 });
                    }
                    if (selection == "special permits")
                    {
                        questItemsBase.Clear();
                        questItemsBase.Add(new QuestItem { QuestLevel = "I", QuestValue = 1 });
                        questItemsBase.Add(new QuestItem { QuestLevel = "II", QuestValue = 2 });
                        questItemsBase.Add(new QuestItem { QuestLevel = "III", QuestValue = 3 });
                        questItemsBase.Add(new QuestItem { QuestLevel = "IV", QuestValue = 4 });
                        questItemsBase.Add(new QuestItem { QuestLevel = "V", QuestValue = 5 });
                        questItemsBase.Add(new QuestItem { QuestLevel = "VI", QuestValue = 6 });
                        questItemsBase.Add(new QuestItem { QuestLevel = "VII", QuestValue = 7 });
                        questItemsBase.Add(new QuestItem { QuestLevel = "VIII", QuestValue = 8 });
                        questItemsBase.Add(new QuestItem { QuestLevel = "IX", QuestValue = 9 });
                        questItemsBase.Add(new QuestItem { QuestLevel = "X", QuestValue = 10 });
                        questItemsBase.Add(new QuestItem { QuestLevel = "G1", QuestValue = 11 });
                        questItemsBase.Add(new QuestItem { QuestLevel = "G2", QuestValue = 12 });
                        questItemsBase.Add(new QuestItem { QuestLevel = "G3", QuestValue = 13 });
                        questItemsBase.Add(new QuestItem { QuestLevel = "G4", QuestValue = 14 });
                        questItemsBase.Add(new QuestItem { QuestLevel = "G5", QuestValue = 15 });
                        questItemsBase.Add(new QuestItem { QuestLevel = "EX", QuestValue = 100 });
                    }
                    if (selection == "events")
                    {
                        questItemsBase.Clear();
                        questItemsBase.Add(new QuestItem { QuestLevel = "Low", QuestValue = 1 });
                        questItemsBase.Add(new QuestItem { QuestLevel = "High", QuestValue = 2 });
                        questItemsBase.Add(new QuestItem { QuestLevel = "G Rank", QuestValue = 3 });
                    }
                    if (questLevel != null)
                    {
                        questLevel.ItemsSource = questItemsBase;
                    }
                }
            }
        }
        public class Quest
        {
            public string Type { get; set; }
            public string Name { get; set; }
            public string Main { get; set; }
            public int Level { get; set; }
            public bool LgMonster { get; set; }
            public bool Prowler { get; set; }
            public bool Hyper { get; set; }
            public bool Egg { get; set; }
            public bool Gathering { get; set; }
            public bool SmMonsters { get; set; }

        }

        private void RollHunterArt(int slotnum, string weapon)
        {
            int art = Random.Shared.Next(0, 177);
            if(arts[art].HunterArtName == slot1 || arts[art].HunterArtName == slot2)
            {
                RollHunterArt(slotnum, weapon);
            }
            if (arts[art].Weapon.ToLower() != "all" && arts[art].Weapon != weapon)
            {
                RollHunterArt(slotnum, weapon);
            }
            if (arts[art].Weapon == weapon || arts[art].Weapon.ToLower() == "all")
            {
                switch (slotnum)
                {
                    case 1:
                        hunterArt1.Text = arts[art].HunterArtName;
                        break;
                    case 2:
                        hunterArt2.Text = arts[art].HunterArtName;
                        break;
                    case 3:
                        hunterArt3.Text = arts[art].HunterArtName;
                        break;
                }
            }
        }

        private async void SubmitButton_ClickAsync(object sender, RoutedEventArgs e)
        {
            Debug.WriteLine("Button Clicked");
            var level = Convert.ToInt32(questLevel.SelectedValue);
            List<Quest> possibleQuests = new List<Quest>();

            foreach(Quest q in quests)
            {
                //Quest Type
                if (q.Type.ToLower() == questType.SelectedValue.ToString().ToLower())
                {
                    //Quest Level
                    if (q.Level <= Convert.ToInt32(questLevel.SelectedValue))
                    {
                        //Prowler?
                        if (q.LgMonster == true ||
                            (q.Prowler == true && prowlerQuestsCheck.IsChecked == true) ||
                            (q.Hyper == true && hyperCheck.IsChecked == true) ||
                            (q.Egg == true && eggCheck.IsChecked == true) ||
                            (q.Gathering == true && gatheringCheck.IsChecked == true) ||
                            (q.SmMonsters == true && smMonstersCheck.IsChecked == true))
                        {
                            Debug.WriteLine(format: "Quest, " + q.Name + " to the pool");
                            possibleQuests.Add(q);
                        }
                    }
                }
            }

            if (possibleQuests.Count == 0)
                possibleQuests.Add(new Quest()); //This is to ensure there is a 'quest record' if none are added
            int value = Random.Shared.Next(0, possibleQuests.Count); //Quest Roll
            var randomQuestSelection = possibleQuests[value];
            questName.Text = randomQuestSelection.Name;
            questMain.Text = randomQuestSelection.Main;


            //Weapon and Arts Section
            var weapon = "";
            List<string> weapons = new List<string>();
            if (gsCheck.IsChecked == false)
            {
                weapons.Add("Great Sword");
            }
            if (lsCheck.IsChecked == false)
            {
                weapons.Add("Long Sword");
            }
            if (snsCheck.IsChecked == false)
            {
                weapons.Add("Sword & Shield");
            }
            if (dbCheck.IsChecked == false)
            {
                weapons.Add("Dual Blades");
            }
            if (hmCheck.IsChecked == false)
            {
                weapons.Add("Hammer");
            }
            if (hhCheck.IsChecked == false)
            {
                weapons.Add("Hunting Horn");
            }
            if (lncCheck.IsChecked == false)
            {
                weapons.Add("Lance");
            }
            if (glCheck.IsChecked == false)
            {
                weapons.Add("Gunlance");
            }
            if (saCheck.IsChecked == false)
            {
                weapons.Add("Switch Axe");
            }
            if (cbCheck.IsChecked == false)
            {
                weapons.Add("Charge Blade");
            }
            if (igCheck.IsChecked == false)
            {
                weapons.Add("Insect Glaive");
            }
            if (lbgCheck.IsChecked == false)
            {
                weapons.Add("Light Bowgun");
            }
            if (hbgCheck.IsChecked == false)
            {
                weapons.Add("Heavy Bowgun");
            }
            if (bowCheck.IsChecked == false)
            {
                weapons.Add("Bow");
            }
            if (prowlerCheck.IsChecked == true)
            {
                weapons.Add("Prowler");
            }
            weapon = weaponText.Text = weapons[Random.Shared.Next(1, weapons.Count)].ToString();

            //Styles Section
            if (weapon.ToLower() != "Prowler".ToLower())
            {
                List<string> styles = new List<string>();
                if(gldCheck.IsChecked == false)
                {
                    styles.Add("Guild");
                }
                if (stkrCheck.IsChecked == false)
                {
                    styles.Add("Striker");
                }
                if (adpCheck.IsChecked == false)
                {
                    styles.Add("Adept");
                }
                if (arlCheck.IsChecked == false)
                {
                    styles.Add("Aerial");
                }
                if (vlrCheck.IsChecked == false)
                {
                    styles.Add("Valor");
                }
                if (alcCheck.IsChecked == false)
                {
                    styles.Add("Alchemy");
                }

                var ind = Random.Shared.Next(0, styles.Count); //Style Roll
                styleText.Text = styles[ind];

                hunterArt1.Text = "";
                hunterArt2.Text = "";
                hunterArt3.Text = "";

                //Hunter Art Rolls
                //Arts will be a single JSON
                //Each Art will be lablled by Weapon/Generic
                switch (ind)
                {
                    case 0:
                        RollHunterArt(1, weapon);
                        RollHunterArt(2, weapon);
                        break;
                    case 1:
                        RollHunterArt(1, weapon);
                        RollHunterArt(2, weapon);
                        RollHunterArt(3, weapon);
                        break;
                    case 2:
                        RollHunterArt(1, weapon);
                        break;
                    case 3:
                        RollHunterArt(1, weapon);
                        break;
                    case 4:
                        RollHunterArt(1, weapon);
                        break;
                    case 5:
                        RollHunterArt(1, weapon);
                        RollHunterArt(2, weapon);
                        RollHunterArt(3, weapon);
                        break;
                    default:
                        RollHunterArt(1, weapon);
                        break;
                }
            }
            else
            {
                List<string> biases = ["Charisma", "Fighting", "Protection", "Assisting", "Healing", "Bombing", "Gathering", "Beast"];
                var ind = Random.Shared.Next(0, 6); //Bias Roll
                styleText.Text = biases[ind];
                hunterArt1.Text = "";
                hunterArt2.Text = "";
                hunterArt3.Text = "";
            }
        }
    }
}

