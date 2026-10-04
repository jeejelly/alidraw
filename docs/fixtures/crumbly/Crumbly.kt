import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// Rows and columns inferred from the canvas; widths that reach the edge stretch, the rest keep their size. 1 group(s) of overlapping parts could not be split and stay fixed.
// 7 x overlapping parts (kept at their relative place in a fixed box)
// 54 x path (inline SVG in HTML, a placeholder in Compose)

val AppColors = lightColorScheme(
    primary = Color(0xFFFF6B57),
    onPrimary = Color(0xFFFFFFFF),
    secondaryContainer = Color(0xFFECEEF7),
    surface = Color(0xFFFFFFFF),
    background = Color(0xFFF4F5FB),
    onSurface = Color(0xFF14142B),
    onSurfaceVariant = Color(0xFF8B8DA5),
    outline = Color(0xFFE1E3EF),
    error = Color(0xFFFF4D6A),
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun Screen() {
    MaterialTheme(colorScheme = AppColors) {
        Box(Modifier.widthIn(max = 2440.dp)) {
            Column(
                Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Box(Modifier) {
                    Row(
                        Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.Top,
                    ) {
                        Box(Modifier) {
                            Box(Modifier.size(360.dp, 720.dp)) {
                                Box(Modifier.offset(0.dp, 0.dp)) {
                                    
                                }
                                Box(Modifier.offset(0.dp, 28.dp)) {
                                    LargeTopAppBar(
                                        title = { Text("Welcome to Crumbly") },
                                    )
                                }
                                Box(Modifier.offset(16.dp, 600.dp)) {
                                    Button(
                                        onClick = { /* TODO */ },
                                        modifier = Modifier.width(328.dp),
                                    ) {
                                        Text("Let's bake")
                                    }
                                }
                                Box(Modifier.offset(60.dp, 492.dp)) {
                                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                        OutlinedButton(onClick = { /* TODO */ }) { Text("1") }
                                        Button(onClick = { /* TODO */ }) { Text("2") }
                                        OutlinedButton(onClick = { /* TODO */ }) { Text("3") }
                                        OutlinedButton(onClick = { /* TODO */ }) { Text("4") }
                                        OutlinedButton(onClick = { /* TODO */ }) { Text("5") }
                                    }
                                }
                                Box(Modifier.offset(55.4.dp, 212.4.dp)) {
                                    Spacer(Modifier.size(253.8.dp, 253.7.dp)) // TODO: path: draw it with Canvas or a vector asset
                                }
                                Box(Modifier.offset(117.3.dp, 354.6.dp)) {
                                    Spacer(Modifier.size(125.4.dp, 114.4.dp)) // TODO: path: draw it with Canvas or a vector asset
                                }
                                Box(Modifier.offset(148.5.dp, 353.5.dp)) {
                                    Spacer(Modifier.size(63.dp, 21.4.dp)) // TODO: path: draw it with Canvas or a vector asset
                                }
                                Box(Modifier.offset(168.dp, 337.dp)) {
                                    Box(
                                        Modifier
                                            .size(24.dp, 30.dp)
                                            .background(Color(0xFFE8A987), RoundedCornerShape(6.dp)),
                                    )
                                }
                                Box(Modifier.offset(145.5.dp, 274.dp)) {
                                    Box(
                                        Modifier
                                            .size(69.dp, 69.dp)
                                            .background(Color(0xFFF3C3A0), CircleShape),
                                    )
                                }
                                Box(Modifier.offset(125.1.dp, 251.4.dp)) {
                                    Spacer(Modifier.size(102.9.dp, 94.7.dp)) // TODO: path: draw it with Canvas or a vector asset
                                }
                                Box(Modifier.offset(165.3.dp, 314.8.dp)) {
                                    Box(
                                        Modifier
                                            .size(5.4.dp, 5.4.dp)
                                            .background(Color(0xFF1D2233), CircleShape),
                                    )
                                }
                                Box(Modifier.offset(190.8.dp, 314.8.dp)) {
                                    Box(
                                        Modifier
                                            .size(5.4.dp, 5.4.dp)
                                            .background(Color(0xFF1D2233), CircleShape),
                                    )
                                }
                                Box(Modifier.offset(174.dp, 329.5.dp)) {
                                    Spacer(Modifier.size(15.dp, 3.4.dp)) // TODO: path: draw it with Canvas or a vector asset
                                }
                                Box(Modifier.offset(153.8.dp, 321.3.dp)) {
                                    Box(
                                        Modifier
                                            .size(10.5.dp, 10.5.dp)
                                            .background(Color(0xFFFF8F86), CircleShape),
                                    )
                                }
                                Box(Modifier.offset(197.3.dp, 321.3.dp)) {
                                    Box(
                                        Modifier
                                            .size(10.5.dp, 10.5.dp)
                                            .background(Color(0xFFFF8F86), CircleShape),
                                    )
                                }
                                Box(Modifier.offset(99.6.dp, 386.5.dp)) {
                                    Spacer(Modifier.size(65.2.dp, 72.4.dp)) // TODO: path: draw it with Canvas or a vector asset
                                }
                                Box(Modifier.offset(195.2.dp, 386.5.dp)) {
                                    Spacer(Modifier.size(65.2.dp, 72.4.dp)) // TODO: path: draw it with Canvas or a vector asset
                                }
                                Box(Modifier.offset(133.5.dp, 380.5.dp)) {
                                    Spacer(Modifier.size(93.dp, 93.dp)) // TODO: path: draw it with Canvas or a vector asset
                                }
                                Box(Modifier.offset(154.5.dp, 407.5.dp)) {
                                    Box(
                                        Modifier
                                            .size(9.dp, 9.dp)
                                            .background(Color(0xFF5A301C), CircleShape),
                                    )
                                }
                                Box(Modifier.offset(185.3.dp, 436.8.dp)) {
                                    Box(
                                        Modifier
                                            .size(10.5.dp, 10.5.dp)
                                            .background(Color(0xFF5A301C), CircleShape),
                                    )
                                }
                                Box(Modifier.offset(153.4.dp, 439.4.dp)) {
                                    Box(
                                        Modifier
                                            .size(8.3.dp, 8.3.dp)
                                            .background(Color(0xFF5A301C), CircleShape),
                                    )
                                }
                                Box(Modifier.offset(179.3.dp, 411.3.dp)) {
                                    Box(
                                        Modifier
                                            .size(7.5.dp, 7.5.dp)
                                            .background(Color(0xFF5A301C), CircleShape),
                                    )
                                }
                                Box(Modifier.offset(205.9.dp, 428.9.dp)) {
                                    Box(
                                        Modifier
                                            .size(8.3.dp, 8.3.dp)
                                            .background(Color(0xFF5A301C), CircleShape),
                                    )
                                }
                                Box(Modifier.offset(123.dp, 430.8.dp)) {
                                    Box(
                                        Modifier
                                            .size(33.dp, 25.5.dp)
                                            .background(Color(0xFFF3C3A0), CircleShape),
                                    )
                                }
                                Box(Modifier.offset(204.dp, 430.8.dp)) {
                                    Box(
                                        Modifier
                                            .size(33.dp, 25.5.dp)
                                            .background(Color(0xFFF3C3A0), CircleShape),
                                    )
                                }
                                Box(Modifier.offset(240.8.dp, 373.8.dp)) {
                                    Box(
                                        Modifier
                                            .size(7.5.dp, 7.5.dp)
                                            .background(Color(0xFFD9964B), CircleShape),
                                    )
                                }
                                Box(Modifier.offset(252.4.dp, 389.9.dp)) {
                                    Box(
                                        Modifier
                                            .size(5.3.dp, 5.3.dp)
                                            .background(Color(0xFFD9964B), CircleShape),
                                    )
                                }
                                Box(Modifier.offset(234.8.dp, 366.3.dp)) {
                                    Box(
                                        Modifier
                                            .size(4.5.dp, 4.5.dp)
                                            .background(Color(0xFFD9964B), CircleShape),
                                    )
                                }
                                Box(Modifier.offset(89.3.dp, 274.dp)) {
                                    Spacer(Modifier.size(25.5.dp, 25.5.dp)) // TODO: path: draw it with Canvas or a vector asset
                                }
                                Box(Modifier.offset(254.3.dp, 280.dp)) {
                                    Spacer(Modifier.size(19.5.dp, 19.5.dp)) // TODO: path: draw it with Canvas or a vector asset
                                }
                            }
                        }
                        Spacer(Modifier.width(160.dp))
                        Box(Modifier) {
                            Box(Modifier.size(360.dp, 720.dp)) {
                                Box(Modifier.offset(0.dp, 0.dp)) {
                                    
                                }
                                Box(Modifier.offset(0.dp, 28.dp)) {
                                    TopAppBar(
                                        title = { Text("Crumbly") },
                                    )
                                }
                                Box(Modifier.offset(0.dp, 648.dp)) {
                                    NavigationBar {
                                        NavigationBarItem(selected = true, onClick = { /* TODO */ }, icon = { Icon(Icons.Default.Home, contentDescription = null) }, label = { Text("Home") })
                                        NavigationBarItem(selected = false, onClick = { /* TODO */ }, icon = { Icon(Icons.Default.Search, contentDescription = null) }, label = { Text("Search") })
                                        NavigationBarItem(selected = false, onClick = { /* TODO */ }, icon = { Icon(Icons.Default.Favorite, contentDescription = null) }, label = { Text("Saved") })
                                        NavigationBarItem(selected = false, onClick = { /* TODO */ }, icon = { Icon(Icons.Default.Person, contentDescription = null) }, label = { Text("Profile") })
                                    }
                                }
                                Box(Modifier.offset(16.dp, 96.dp)) {
                                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                        FilterChip(selected = false, onClick = { /* TODO */ }, label = { Text("All") })
                                        FilterChip(selected = false, onClick = { /* TODO */ }, label = { Text("Chip") })
                                        FilterChip(selected = false, onClick = { /* TODO */ }, label = { Text("Oatmeal") })
                                        FilterChip(selected = false, onClick = { /* TODO */ }, label = { Text("Shortbread") })
                                    }
                                }
                                Box(Modifier.offset(16.dp, 152.dp)) {
                                    OutlinedCard(
                                        shape = RoundedCornerShape(28.dp),
                                        modifier = Modifier.width(328.dp),
                                    ) {
                                        Box(Modifier.fillMaxWidth().height(80.dp).background(MaterialTheme.colorScheme.secondaryContainer))
                                        Column(Modifier.padding(16.dp)) {
                                            Text("Maya ate 3 chocolate chips", style = MaterialTheme.typography.titleMedium)
                                            Text("Still warm. Would dunk again.", style = MaterialTheme.typography.bodySmall)
                                        }
                                    }
                                }
                                Box(Modifier.offset(16.dp, 316.dp)) {
                                    OutlinedCard(
                                        shape = RoundedCornerShape(28.dp),
                                        modifier = Modifier.width(328.dp),
                                    ) {
                                        Box(Modifier.fillMaxWidth().height(80.dp).background(MaterialTheme.colorScheme.secondaryContainer))
                                        Column(Modifier.padding(16.dp)) {
                                            Text("Leo dunked oatmeal raisin", style = MaterialTheme.typography.titleMedium)
                                            Text("Two glasses of milk later.", style = MaterialTheme.typography.bodySmall)
                                        }
                                    }
                                }
                                Box(Modifier.offset(280.dp, 578.dp)) {
                                    FloatingActionButton(onClick = { /* TODO */ }) {
                                        Icon(Icons.Default.Add, contentDescription = "plus")
                                    }
                                }
                            }
                        }
                        Spacer(Modifier.width(44.dp))
                        Box(Modifier.padding(top = 523.8.dp)) {
                            Text("tap", fontSize = 20.sp, color = Color(0xFFE0449B))
                        }
                        Spacer(Modifier.width(86.dp))
                        Box(Modifier) {
                            Box(Modifier.size(360.dp, 720.dp)) {
                                Box(Modifier.offset(0.dp, 0.dp)) {
                                    
                                }
                                Box(Modifier.offset(0.dp, 28.dp)) {
                                    TopAppBar(
                                        title = { Text("New crumb") },
                                        navigationIcon = { IconButton(onClick = { /* TODO */ }) { Icon(Icons.Default.ArrowBack, contentDescription = null) } },
                                    )
                                }
                                Box(Modifier.offset(16.dp, 100.5.dp)) {
                                    var text by remember { mutableStateOf("") }
                                    OutlinedTextField(
                                        value = text,
                                        onValueChange = { text = it },
                                        label = { Text("Which cookie?") },
                                        shape = RoundedCornerShape(20.dp),
                                        modifier = Modifier.width(328.dp),
                                    )
                                }
                                Box(Modifier.offset(16.dp, 180.5.dp)) {
                                    var text by remember { mutableStateOf("") }
                                    OutlinedTextField(
                                        value = text,
                                        onValueChange = { text = it },
                                        label = { Text("How did it go?") },
                                        shape = RoundedCornerShape(20.dp),
                                        modifier = Modifier.width(328.dp),
                                    )
                                }
                                Box(Modifier.offset(16.dp, 270.dp)) {
                                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                        FilterChip(selected = false, onClick = { /* TODO */ }, label = { Text("Warm") })
                                        FilterChip(selected = false, onClick = { /* TODO */ }, label = { Text("Crunchy") })
                                        FilterChip(selected = false, onClick = { /* TODO */ }, label = { Text("Chewy") })
                                        FilterChip(selected = false, onClick = { /* TODO */ }, label = { Text("Dunked") })
                                    }
                                }
                                Box(Modifier.offset(16.dp, 400.dp)) {
                                    Button(
                                        onClick = { /* TODO */ },
                                        modifier = Modifier.width(328.dp),
                                    ) {
                                        Text("Share a crumb")
                                    }
                                }
                                Box(Modifier.offset(19.4.dp, 333.5.dp)) {
                                    Row {
                                        repeat(5) { index ->
                                            Icon(Icons.Default.Star, contentDescription = null, tint = if (index < 4) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline)
                                        }
                                    }
                                }
                            }
                        }
                        Spacer(Modifier.width(160.dp))
                        Box(Modifier) {
                            Box(Modifier.size(360.dp, 720.dp)) {
                                Box(Modifier.offset(0.dp, 0.dp)) {
                                    
                                }
                                Box(Modifier.offset(0.dp, 28.dp)) {
                                    CenterAlignedTopAppBar(
                                        title = { Text("Maya") },
                                    )
                                }
                                Box(Modifier.offset(0.dp, 648.dp)) {
                                    NavigationBar {
                                        NavigationBarItem(selected = true, onClick = { /* TODO */ }, icon = { Icon(Icons.Default.Home, contentDescription = null) }, label = { Text("Home") })
                                        NavigationBarItem(selected = false, onClick = { /* TODO */ }, icon = { Icon(Icons.Default.Search, contentDescription = null) }, label = { Text("Search") })
                                        NavigationBarItem(selected = false, onClick = { /* TODO */ }, icon = { Icon(Icons.Default.Favorite, contentDescription = null) }, label = { Text("Saved") })
                                        NavigationBarItem(selected = false, onClick = { /* TODO */ }, icon = { Icon(Icons.Default.Person, contentDescription = null) }, label = { Text("Profile") })
                                    }
                                }
                                Box(Modifier.offset(16.dp, 190.dp)) {
                                    LinearProgressIndicator(progress = { 0.72f }, modifier = Modifier.width(328.dp))
                                }
                                Box(Modifier.offset(16.dp, 241.3.dp)) {
                                    TabRow(selectedTabIndex = 0) {
                                        Tab(selected = true, onClick = { /* TODO */ }, text = { Text("Crumbs") })
                                        Tab(selected = false, onClick = { /* TODO */ }, text = { Text("Bakers") })
                                        Tab(selected = false, onClick = { /* TODO */ }, text = { Text("Jars") })
                                    }
                                }
                                Box(Modifier.offset(16.dp, 290.dp)) {
                                    LazyColumn {
                                        items(listOf("Chocolate milk", "Apple pie", "Tomato soup", "Pancakes")) { item ->
                                            ListItem(headlineContent = { Text(item) }, supportingContent = { Text("Secondary text") })
                                        }
                                    }
                                }
                                Box(Modifier.offset(16.dp, 104.dp)) {
                                    Box(
                                        Modifier
                                            .size(44.dp, 44.dp)
                                            .background(Color(0xFFECEEF7), CircleShape)
                                            .border(1.dp, Color(0xFFE1E3EF), CircleShape),
                                    )
                                }
                                Box(Modifier.offset(34.dp, 118.dp)) {
                                    Spacer(Modifier.size(8.dp, 8.dp)) // TODO: path: draw it with Canvas or a vector asset
                                }
                                Box(Modifier.offset(30.dp, 128.dp)) {
                                    Spacer(Modifier.size(16.dp, 6.dp)) // TODO: path: draw it with Canvas or a vector asset
                                }
                            }
                        }
                        Spacer(Modifier.width(160.dp))
                        Box(Modifier) {
                            Box(Modifier.size(360.dp, 720.dp)) {
                                Box(Modifier.offset(0.dp, 0.dp)) {
                                    
                                }
                                Box(Modifier.offset(0.dp, 28.dp)) {
                                    LargeTopAppBar(
                                        title = { Text("Thank you!") },
                                    )
                                }
                                Box(Modifier.offset(16.dp, 600.dp)) {
                                    Button(
                                        onClick = { /* TODO */ },
                                        modifier = Modifier.width(328.dp),
                                    ) {
                                        Text("Continue")
                                    }
                                }
                                Box(Modifier.offset(62.9.dp, 219.9.dp)) {
                                    Spacer(Modifier.size(238.7.dp, 238.7.dp)) // TODO: path: draw it with Canvas or a vector asset
                                }
                                Box(Modifier.offset(63.dp, 235.dp)) {
                                    Box(
                                        Modifier
                                            .size(39.dp, 39.dp)
                                            .border(2.25.dp, Color(0xFFF5C542), CircleShape),
                                    )
                                }
                                Box(Modifier.offset(270.8.dp, 408.3.dp)) {
                                    Box(
                                        Modifier
                                            .size(13.5.dp, 13.5.dp)
                                            .background(Color(0xFFFF6B57), CircleShape),
                                    )
                                }
                                Box(Modifier.offset(90.dp, 422.5.dp)) {
                                    Box(
                                        Modifier
                                            .size(9.dp, 9.dp)
                                            .background(Color(0xFF33B866), CircleShape),
                                    )
                                }
                                Box(Modifier.offset(250.5.dp, 245.5.dp)) {
                                    Spacer(Modifier.size(36.dp, 34.5.dp)) // TODO: path: draw it with Canvas or a vector asset
                                }
                                Box(Modifier.offset(117.1.dp, 384.2.dp)) {
                                    Spacer(Modifier.size(50.2.dp, 55.2.dp)) // TODO: path: draw it with Canvas or a vector asset
                                }
                                Box(Modifier.offset(127.9.dp, 332.7.dp)) {
                                    Spacer(Modifier.size(24.1.dp, 55.dp)) // TODO: path: draw it with Canvas or a vector asset
                                }
                                Box(Modifier.offset(140.8.dp, 320.8.dp)) {
                                    Spacer(Modifier.size(28.9.dp, 70.7.dp)) // TODO: path: draw it with Canvas or a vector asset
                                }
                                Box(Modifier.offset(153.7.dp, 330.5.dp)) {
                                    Spacer(Modifier.size(27.2.dp, 65.dp)) // TODO: path: draw it with Canvas or a vector asset
                                }
                                Box(Modifier.offset(164.6.dp, 349.7.dp)) {
                                    Spacer(Modifier.size(22.2.dp, 50.6.dp)) // TODO: path: draw it with Canvas or a vector asset
                                }
                                Box(Modifier.offset(106.8.dp, 361.6.dp)) {
                                    Spacer(Modifier.size(21.8.dp, 39.9.dp)) // TODO: path: draw it with Canvas or a vector asset
                                }
                                Box(Modifier.offset(125.2.dp, 380.1.dp)) {
                                    Spacer(Modifier.size(46.1.dp, 23.7.dp)) // TODO: path: draw it with Canvas or a vector asset
                                }
                                Box(Modifier.offset(82.3.dp, 416.2.dp)) {
                                    Spacer(Modifier.size(85.8.dp, 80.9.dp)) // TODO: path: draw it with Canvas or a vector asset
                                }
                                Box(Modifier.offset(104.5.dp, 432.4.dp)) {
                                    Spacer(Modifier.size(57.4.dp, 17.5.dp)) // TODO: path: draw it with Canvas or a vector asset
                                }
                                Box(Modifier.offset(98.6.dp, 446.3.dp)) {
                                    Spacer(Modifier.size(60.2.dp, 18.4.dp)) // TODO: path: draw it with Canvas or a vector asset
                                }
                                Box(Modifier.offset(108.6.dp, 461.9.dp)) {
                                    Spacer(Modifier.size(13.5.dp, 13.5.dp)) // TODO: path: draw it with Canvas or a vector asset
                                }
                                Box(Modifier.offset(123.1.dp, 472.1.dp)) {
                                    Spacer(Modifier.size(10.5.dp, 10.5.dp)) // TODO: path: draw it with Canvas or a vector asset
                                }
                                Box(Modifier.offset(192.8.dp, 384.2.dp)) {
                                    Spacer(Modifier.size(50.2.dp, 55.2.dp)) // TODO: path: draw it with Canvas or a vector asset
                                }
                                Box(Modifier.offset(208.1.dp, 332.7.dp)) {
                                    Spacer(Modifier.size(24.1.dp, 55.dp)) // TODO: path: draw it with Canvas or a vector asset
                                }
                                Box(Modifier.offset(190.3.dp, 320.8.dp)) {
                                    Spacer(Modifier.size(28.9.dp, 70.7.dp)) // TODO: path: draw it with Canvas or a vector asset
                                }
                                Box(Modifier.offset(179.2.dp, 330.5.dp)) {
                                    Spacer(Modifier.size(27.2.dp, 65.dp)) // TODO: path: draw it with Canvas or a vector asset
                                }
                                Box(Modifier.offset(173.1.dp, 349.7.dp)) {
                                    Spacer(Modifier.size(22.2.dp, 50.6.dp)) // TODO: path: draw it with Canvas or a vector asset
                                }
                                Box(Modifier.offset(231.4.dp, 361.6.dp)) {
                                    Spacer(Modifier.size(21.8.dp, 39.9.dp)) // TODO: path: draw it with Canvas or a vector asset
                                }
                                Box(Modifier.offset(188.7.dp, 380.1.dp)) {
                                    Spacer(Modifier.size(46.1.dp, 23.7.dp)) // TODO: path: draw it with Canvas or a vector asset
                                }
                                Box(Modifier.offset(191.9.dp, 416.2.dp)) {
                                    Spacer(Modifier.size(85.8.dp, 80.9.dp)) // TODO: path: draw it with Canvas or a vector asset
                                }
                                Box(Modifier.offset(223.2.dp, 450.2.dp)) {
                                    Spacer(Modifier.size(22.dp, 15.1.dp)) // TODO: path: draw it with Canvas or a vector asset
                                }
                                Box(Modifier.offset(230.5.dp, 454.dp)) {
                                    Spacer(Modifier.size(7.5.dp, 7.5.dp)) // TODO: path: draw it with Canvas or a vector asset
                                }
                                Box(Modifier.offset(180.dp, 242.5.dp)) {
                                    Spacer(Modifier.size(0.dp, 19.5.dp)) // TODO: path: draw it with Canvas or a vector asset
                                }
                                Box(Modifier.offset(147.dp, 254.5.dp)) {
                                    Spacer(Modifier.size(10.5.dp, 15.dp)) // TODO: path: draw it with Canvas or a vector asset
                                }
                                Box(Modifier.offset(202.5.dp, 254.5.dp)) {
                                    Spacer(Modifier.size(10.5.dp, 15.dp)) // TODO: path: draw it with Canvas or a vector asset
                                }
                            }
                        }
                    }
                }
                Spacer(Modifier.height(290.dp))
                Box(Modifier) {
                    Box(Modifier.size(800.dp, 500.dp)) {
                        Box(Modifier.offset(0.dp, 0.dp)) {
                            
                        }
                        Box(Modifier.offset(0.dp, 40.dp)) {
                            TopAppBar(
                                title = { Text("Crumbly") },
                            )
                        }
                        Box(Modifier.offset(24.dp, 112.dp)) {
                            var query by remember { mutableStateOf("") }
                            SearchBar(
                                inputField = {
                                    SearchBarDefaults.InputField(
                                        query = query, onQueryChange = { query = it },
                                        onSearch = { /* TODO */ }, expanded = false, onExpandedChange = {},
                                        placeholder = { Text("Search or paste a link") },
                                        leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                                    )
                                },
                                expanded = false, onExpandedChange = {},
                                modifier = Modifier.width(400.dp),
                            ) {}
                        }
                        Box(Modifier.offset(640.dp, 112.dp)) {
                            Button(
                                onClick = { /* TODO */ },
                                modifier = Modifier.width(136.dp),
                            ) {
                                Text("Get the app")
                            }
                        }
                        Box(Modifier.offset(24.dp, 172.dp)) {
                            OutlinedCard(
                                shape = RoundedCornerShape(28.dp),
                                modifier = Modifier.width(400.dp),
                            ) {
                                Box(Modifier.fillMaxWidth().height(80.dp).background(MaterialTheme.colorScheme.secondaryContainer))
                                Column(Modifier.padding(16.dp)) {
                                    Text("Tonight's jar: oatmeal raisin", style = MaterialTheme.typography.titleMedium)
                                    Text("412 bakers are dunking right now", style = MaterialTheme.typography.bodySmall)
                                }
                            }
                        }
                        Box(Modifier.offset(464.dp, 196.dp)) {
                            LazyColumn {
                                items(listOf("Chocolate milk", "Apple pie", "Tomato soup")) { item ->
                                    ListItem(headlineContent = { Text(item) }, supportingContent = { Text("Secondary text") })
                                }
                            }
                        }
                        Box(Modifier.offset(30.6.dp, 386.6.dp)) {
                            Column(
                                Modifier
                                    .width(96.8.dp)
                                    .background(Color(0xFFF6C443), RoundedCornerShape(19.3.dp))
                                    .padding(start = 8.2.dp, top = 12.7.dp, end = 8.2.dp, bottom = 11.5.dp),
                            ) {
                                Box(Modifier.size(80.4.dp, 72.6.dp)) {
                                    Box(Modifier.offset(1.7.dp, 71.5.dp)) {
                                        Spacer(Modifier.size(77.dp, 0.dp)) // TODO: path: draw it with Canvas or a vector asset
                                    }
                                    Box(Modifier.offset(0.dp, 43.5.dp)) {
                                        Spacer(Modifier.size(8.5.dp, 28.1.dp)) // TODO: path: draw it with Canvas or a vector asset
                                    }
                                    Box(Modifier.offset(9.9.dp, 46.2.dp)) {
                                        Spacer(Modifier.size(9.9.dp, 25.3.dp)) // TODO: path: draw it with Canvas or a vector asset
                                    }
                                    Box(Modifier.offset(71.9.dp, 43.5.dp)) {
                                        Spacer(Modifier.size(8.5.dp, 28.1.dp)) // TODO: path: draw it with Canvas or a vector asset
                                    }
                                    Box(Modifier.offset(60.5.dp, 46.2.dp)) {
                                        Spacer(Modifier.size(9.9.dp, 25.3.dp)) // TODO: path: draw it with Canvas or a vector asset
                                    }
                                    Box(Modifier.offset(13.8.dp, 18.7.dp)) {
                                        Spacer(Modifier.size(52.8.dp, 52.3.dp)) // TODO: path: draw it with Canvas or a vector asset
                                    }
                                    Box(Modifier.offset(13.8.dp, 18.7.dp)) {
                                        Spacer(Modifier.size(52.8.dp, 20.9.dp)) // TODO: path: draw it with Canvas or a vector asset
                                    }
                                    Box(Modifier.offset(23.7.dp, 56.1.dp)) {
                                        Box(
                                            Modifier
                                                .size(16.5.dp, 16.5.dp)
                                                .background(Color(0xFFD9964B), CircleShape),
                                        )
                                    }
                                    Box(Modifier.offset(39.6.dp, 53.9.dp)) {
                                        Box(
                                            Modifier
                                                .size(18.7.dp, 18.7.dp)
                                                .background(Color(0xFFE0A45B), CircleShape),
                                        )
                                    }
                                    Box(Modifier.offset(31.9.dp, 44.5.dp)) {
                                        Box(
                                            Modifier
                                                .size(16.5.dp, 16.5.dp)
                                                .background(Color(0xFFC98640), CircleShape),
                                        )
                                    }
                                    Box(Modifier.offset(27.9.dp, 61.5.dp)) {
                                        Box(
                                            Modifier
                                                .size(2.5.dp, 2.5.dp)
                                                .background(Color(0xFF5A301C), CircleShape),
                                        )
                                    }
                                    Box(Modifier.offset(33.dp, 65.5.dp)) {
                                        Box(
                                            Modifier
                                                .size(2.2.dp, 2.2.dp)
                                                .background(Color(0xFF5A301C), CircleShape),
                                        )
                                    }
                                    Box(Modifier.offset(34.3.dp, 60.6.dp)) {
                                        Box(
                                            Modifier
                                                .size(1.9.dp, 1.9.dp)
                                                .background(Color(0xFF5A301C), CircleShape),
                                        )
                                    }
                                    Box(Modifier.offset(45.5.dp, 59.8.dp)) {
                                        Box(
                                            Modifier
                                                .size(2.5.dp, 2.5.dp)
                                                .background(Color(0xFF5A301C), CircleShape),
                                        )
                                    }
                                    Box(Modifier.offset(51.2.dp, 64.3.dp)) {
                                        Box(
                                            Modifier
                                                .size(2.2.dp, 2.2.dp)
                                                .background(Color(0xFF5A301C), CircleShape),
                                        )
                                    }
                                    Box(Modifier.offset(49.7.dp, 59.dp)) {
                                        Box(
                                            Modifier
                                                .size(1.9.dp, 1.9.dp)
                                                .background(Color(0xFF5A301C), CircleShape),
                                        )
                                    }
                                    Box(Modifier.offset(36.9.dp, 50.dp)) {
                                        Box(
                                            Modifier
                                                .size(2.2.dp, 2.2.dp)
                                                .background(Color(0xFF5A301C), CircleShape),
                                        )
                                    }
                                    Box(Modifier.offset(41.7.dp, 53.8.dp)) {
                                        Box(
                                            Modifier
                                                .size(2.5.dp, 2.5.dp)
                                                .background(Color(0xFF5A301C), CircleShape),
                                        )
                                    }
                                    Box(Modifier.offset(41.dp, 49.2.dp)) {
                                        Box(
                                            Modifier
                                                .size(1.7.dp, 1.7.dp)
                                                .background(Color(0xFF5A301C), CircleShape),
                                        )
                                    }
                                    Box(Modifier.offset(18.7.dp, 33.dp)) {
                                        Spacer(Modifier.size(2.8.dp, 6.6.dp)) // TODO: path: draw it with Canvas or a vector asset
                                    }
                                    Box(Modifier.offset(18.7.dp, 45.7.dp)) {
                                        Spacer(Modifier.size(0.dp, 9.4.dp)) // TODO: path: draw it with Canvas or a vector asset
                                    }
                                    Box(Modifier.offset(29.2.dp, 34.7.dp)) {
                                        Column(
                                            Modifier
                                                .width(22.dp)
                                                .background(Color(0xFFFFFFFF), RoundedCornerShape(3.6.dp))
                                                .padding(start = 4.9.dp, top = 1.6.dp, end = 4.9.dp, bottom = 2.8.dp),
                                        ) {
                                            Spacer(Modifier.size(12.1.dp, 9.9.dp)) // TODO: path: draw it with Canvas or a vector asset
                                        }
                                    }
                                    Box(Modifier.offset(19.8.dp, 11.dp)) {
                                        Column(
                                            Modifier
                                                .width(40.7.dp)
                                                .background(Color(0xFFFF6B57), RoundedCornerShape(2.3.dp))
                                                .padding(start = 0.dp, top = 5.5.dp, end = 0.dp, bottom = 0.dp),
                                        ) {
                                            Box(
                                                Modifier
                                                    .size(40.7.dp, 3.9.dp)
                                                    .background(Color(0xFFE2503F), RoundedCornerShape(1.dp)),
                                            )
                                        }
                                    }
                                    Box(Modifier.offset(35.8.dp, 3.8.dp)) {
                                        Box(
                                            Modifier
                                                .size(8.8.dp, 8.8.dp)
                                                .background(Color(0xFFFF6B57), CircleShape),
                                        )
                                    }
                                    Box(Modifier.offset(4.4.dp, 13.8.dp)) {
                                        Spacer(Modifier.size(2.8.dp, 1.6.dp)) // TODO: path: draw it with Canvas or a vector asset
                                    }
                                    Box(Modifier.offset(73.7.dp, 20.9.dp)) {
                                        Spacer(Modifier.size(3.3.dp, 1.1.dp)) // TODO: path: draw it with Canvas or a vector asset
                                    }
                                    Box(Modifier.offset(9.9.dp, 34.7.dp)) {
                                        Spacer(Modifier.size(1.7.dp, 2.8.dp)) // TODO: path: draw it with Canvas or a vector asset
                                    }
                                    Box(Modifier.offset(72.1.dp, 41.8.dp)) {
                                        Spacer(Modifier.size(2.2.dp, 2.2.dp)) // TODO: path: draw it with Canvas or a vector asset
                                    }
                                    Box(Modifier.offset(64.9.dp, 0.dp)) {
                                        Spacer(Modifier.size(1.7.dp, 2.8.dp)) // TODO: path: draw it with Canvas or a vector asset
                                    }
                                    Box(Modifier.offset(13.2.dp, 1.1.dp)) {
                                        Box(
                                            Modifier
                                                .size(3.3.dp, 3.3.dp)
                                                .background(Color(0xFFFFFFFF), CircleShape),
                                        )
                                    }
                                    Box(Modifier.offset(76.8.dp, 8.dp)) {
                                        Box(
                                            Modifier
                                                .size(2.8.dp, 2.8.dp)
                                                .background(Color(0xFFFFFFFF), CircleShape),
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
