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

// Rows and columns inferred from the canvas; widths that reach the edge stretch, the rest keep their size. No overlaps, everything flows.
// 4 x overlapping parts (kept at their relative place in a fixed box)

val AppColors = lightColorScheme(
    primary = Color(0xFFB5651D),
    onPrimary = Color(0xFFFFFAF0),
    secondaryContainer = Color(0xFFF3E4C8),
    surface = Color(0xFFFFFAF0),
    background = Color(0xFFFBF3E4),
    onSurface = Color(0xFF3B2412),
    onSurfaceVariant = Color(0xFF8A6A4A),
    outline = Color(0xFFE0C9A0),
    error = Color(0xFFC0392B),
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun Screen() {
    MaterialTheme(colorScheme = AppColors) {
        Box(Modifier.widthIn(max = 1400.dp)) {
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
                                        shape = RoundedCornerShape(21.dp),
                                        modifier = Modifier.width(328.dp),
                                    ) {
                                        Box(Modifier.fillMaxWidth().height(80.dp).background(MaterialTheme.colorScheme.secondaryContainer))
                                        Column(Modifier.padding(16.dp)) {
                                            Text("Maya ate 3 chocolate chips", style = MaterialTheme.typography.titleMedium)
                                            Text("Still warm. Would dunk again.", style = MaterialTheme.typography.bodySmall)
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
                        Spacer(Modifier.width(52.dp))
                        Box(Modifier.padding(top = 519.6.dp)) {
                            Text("tap", fontSize = 20.sp, color = Color(0xFF1E1E1E))
                        }
                        Spacer(Modifier.width(78.dp))
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
                                        shape = RoundedCornerShape(14.dp),
                                        modifier = Modifier.width(328.dp),
                                    )
                                }
                                Box(Modifier.offset(16.dp, 180.5.dp)) {
                                    var text by remember { mutableStateOf("") }
                                    OutlinedTextField(
                                        value = text,
                                        onValueChange = { text = it },
                                        label = { Text("How did it go?") },
                                        shape = RoundedCornerShape(14.dp),
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
                                Box(Modifier.offset(16.dp, 104.dp)) {
                                    // TODO: Avatar, photo has no Compose mapping yet
                                    Box(Modifier.size(48.dp))
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
                            }
                        }
                    }
                }
                Spacer(Modifier.height(290.dp))
                Box(Modifier) {
                    Box(Modifier.size(900.dp, 500.dp)) {
                        Box(Modifier.offset(0.dp, 0.dp)) {
                            
                        }
                        Box(Modifier.offset(0.dp, 40.dp)) {
                            TopAppBar(
                                title = { Text("Crumbly") },
                            )
                        }
                        Box(Modifier.offset(260.dp, 112.dp)) {
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
                                modifier = Modifier.width(380.dp),
                            ) {}
                        }
                        Box(Modifier.offset(700.dp, 112.dp)) {
                            Button(
                                onClick = { /* TODO */ },
                                modifier = Modifier.width(160.dp),
                            ) {
                                Text("Get the app")
                            }
                        }
                        Box(Modifier.offset(260.dp, 180.dp)) {
                            OutlinedCard(
                                shape = RoundedCornerShape(21.dp),
                                modifier = Modifier.width(380.dp),
                            ) {
                                Box(Modifier.fillMaxWidth().height(80.dp).background(MaterialTheme.colorScheme.secondaryContainer))
                                Column(Modifier.padding(16.dp)) {
                                    Text("Tonight's jar: oatmeal raisin", style = MaterialTheme.typography.titleMedium)
                                    Text("412 bakers are dunking right now", style = MaterialTheme.typography.bodySmall)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
