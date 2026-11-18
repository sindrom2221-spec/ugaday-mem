from pathlib import Path
import sys

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "ddnet")

def replace_once(relative_path: str, old: str, new: str, label: str) -> None:
    path = ROOT / relative_path
    source = path.read_text(encoding="utf-8")
    count = source.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one match in {relative_path}, found {count}")
    source = source.replace(old, new, 1)
    with path.open("w", encoding="utf-8", newline="\n") as file:
        file.write(source)

# Configuration: all custom settings are added in one deterministic location.
replace_once(
    "src/engine/shared/config_variables.h",
    'MACRO_CONFIG_INT(ClDummyCopyMoves, cl_dummy_copy_moves, 0, 0, 1, CFGFLAG_CLIENT | CFGFLAG_INSENSITIVE, "Whether dummy should copy your moves")',
    '''MACRO_CONFIG_INT(ClDummyCopyMoves, cl_dummy_copy_moves, 0, 0, 1, CFGFLAG_CLIENT | CFGFLAG_INSENSITIVE, "Whether dummy should copy your moves")
MACRO_CONFIG_INT(ClDummyHammerOnW, cl_dummy_hammer_on_w, 1, 0, 1, CFGFLAG_CLIENT | CFGFLAG_SAVE | CFGFLAG_INSENSITIVE, "Whether dummy hammers while holding W")
MACRO_CONFIG_INT(ClDummyHammerWSpeed, cl_dummy_hammer_w_speed, 10, 1, 25, CFGFLAG_CLIENT | CFGFLAG_SAVE | CFGFLAG_INSENSITIVE, "Dummy hammer attempt speed while holding W")
MACRO_CONFIG_INT(ClPixelWalk, cl_pixelwalk, 1, 0, 1, CFGFLAG_CLIENT | CFGFLAG_SAVE | CFGFLAG_INSENSITIVE, "Enable PixelWalk while the +pixelwalk bind is held")
MACRO_CONFIG_INT(ClPixelWalkSpeed, cl_pixelwalk_speed, 5, 1, 10, CFGFLAG_CLIENT | CFGFLAG_SAVE | CFGFLAG_INSENSITIVE, "PixelWalk movement speed")
MACRO_CONFIG_INT(ClAvoidFreeze, cl_avoid_freeze, 0, 0, 1, CFGFLAG_CLIENT | CFGFLAG_SAVE | CFGFLAG_INSENSITIVE, "Avoid moving into nearby freeze tiles")
MACRO_CONFIG_INT(ClAvoidFreezeRange, cl_avoid_freeze_range, 1, 1, 4, CFGFLAG_CLIENT | CFGFLAG_SAVE | CFGFLAG_INSENSITIVE, "Avoid Freeze stopping distance, in 20-pixel steps")
MACRO_CONFIG_INT(ClHookAim, cl_hook_aim, 0, 0, 1, CFGFLAG_CLIENT | CFGFLAG_SAVE | CFGFLAG_INSENSITIVE, "Aim hook toward the closest player in FOV only while the hook key is held")
MACRO_CONFIG_INT(ClHookAimFov, cl_hook_aim_fov, 64, 16, 256, CFGFLAG_CLIENT | CFGFLAG_SAVE | CFGFLAG_INSENSITIVE, "Hook Aim FOV radius in world units")
MACRO_CONFIG_INT(ClHookAimShowFov, cl_hook_aim_show_fov, 1, 0, 1, CFGFLAG_CLIENT | CFGFLAG_SAVE | CFGFLAG_INSENSITIVE, "Show the Hook Aim FOV circle")''',
    "configuration variables",
)

# W-triggered dummy hammer. The physical W key is read without replacing the user's W bind.
replace_once(
    "src/game/client/gameclient.cpp",
    'if(!g_Config.m_ClDummyHammer)\n\t{',
    '''const bool DummyHammerOnW = g_Config.m_ClDummyHammerOnW &&
		Input()->KeyIsPressed(KEY_W) &&
		Client()->State() == IClient::STATE_ONLINE &&
		!m_Menus.IsActive() && !m_Chat.IsActive() && !m_GameConsole.IsActive() &&
		!m_Motd.IsActive() && !m_KeyBinder.IsActive();
	const bool UseDummyHammer = g_Config.m_ClDummyHammer || DummyHammerOnW;

	if(!UseDummyHammer)
	{''',
    "W hammer input",
)
replace_once(
    "src/game/client/gameclient.cpp",
    "if(m_DummyFire % 25 != 0)",
    '''const unsigned int HammerInterval = DummyHammerOnW ?
			(unsigned int)(26 - g_Config.m_ClDummyHammerWSpeed) : 25U;
		if(m_DummyFire % HammerInterval != 0)''',
    "W hammer speed",
)

replace_once(
    "src/game/client/components/controls.cpp",
    "#include <base/dbg.h>\n",
    "#include <base/color.h>\n#include <base/dbg.h>\n",
    "FOV circle color include",
)

# PixelWalk state and key-held command.
replace_once(
    "src/game/client/components/controls.h",
    "\tint m_aShowHookColl[NUM_DUMMIES];",
    "\tint m_aShowHookColl[NUM_DUMMIES];\n\tint m_aManualHook[NUM_DUMMIES];\n\tint m_aPixelWalk[NUM_DUMMIES];\n\tint m_aAvoidFreezeOverride[NUM_DUMMIES];\n\tint m_PixelWalkTick;",
    "PixelWalk controls state",
)
replace_once(
    "src/game/client/components/controls.cpp",
    "#include <game/localization.h>\n",
    "#include <game/localization.h>\n#include <game/mapitems.h>\n",
    "map tile definitions include",
)
replace_once(
    "src/game/client/components/controls.cpp",
    "#include <algorithm>\n",
    '''#include <algorithm>

static bool IsAvoidFreezeTile(int Tile)
{
	return Tile == TILE_FREEZE || Tile == TILE_DFREEZE || Tile == TILE_LFREEZE;
}

static bool IsAvoidFreezeAt(const CCollision &Collision, vec2 Pos)
{
	const int MapIndex = Collision.GetPureMapIndex(Pos);
	if(IsAvoidFreezeTile(Collision.GetTileIndex(MapIndex)) ||
		IsAvoidFreezeTile(Collision.GetFrontTileIndex(MapIndex)))
		return true;

	CDoorTile DoorTile;
	Collision.GetDoorTile(MapIndex, &DoorTile);
	return IsAvoidFreezeTile(DoorTile.m_Index);
}

static bool IsAvoidFreezeAhead(const CCollision &Collision, vec2 Pos, int Direction, int MaxDistance)
{
	for(int Distance = 20; Distance <= MaxDistance; Distance += 8)
	{
		for(int OffsetY = -14; OffsetY <= 14; OffsetY += 14)
		{
			if(IsAvoidFreezeAt(Collision, Pos + vec2(Direction * Distance, OffsetY)))
				return true;
		}
	}
	return false;
}
''',
    "Avoid Freeze tile helpers",
)
replace_once(
    "src/game/client/components/controls.cpp",
    "CControls::CControls()\n{\n",
    "CControls::CControls()\n{\n\tmem_zero(&m_aManualHook, sizeof(m_aManualHook));\n\tm_PixelWalkTick = 0;\n\tmem_zero(&m_aPixelWalk, sizeof(m_aPixelWalk));\n\tmem_zero(&m_aAvoidFreezeOverride, sizeof(m_aAvoidFreezeOverride));\n",
    "PixelWalk constructor initialization",
)
replace_once(
    "src/game/client/components/controls.cpp",
    "void CControls::OnReset()\n{\n\tResetInput(0);",
    "void CControls::OnReset()\n{\n\tm_PixelWalkTick = 0;\n\tResetInput(0);",
    "PixelWalk reset",
)
replace_once(
    "src/game/client/components/controls.cpp",
    "void CControls::ResetInput(int Dummy)\n{\n\tm_aLastData[Dummy].m_Direction = 0;",
    "void CControls::ResetInput(int Dummy)\n{\n\tm_aManualHook[Dummy] = 0;\n\tm_aPixelWalk[Dummy] = 0;\n\tm_aAvoidFreezeOverride[Dummy] = 0;\n\tm_aLastData[Dummy].m_Direction = 0;",
    "PixelWalk input reset",
)
replace_once(
    "src/game/client/components/controls.cpp",
    '''		Console()->Register("+showhookcoll", "", CFGFLAG_CLIENT, ConKeyInputState, &s_State, "Show Hook Collision");
	}

	{
		static CInputSet''',
    '''		Console()->Register("+showhookcoll", "", CFGFLAG_CLIENT, ConKeyInputState, &s_State, "Show Hook Collision");
	}
	{
		static CInputState s_PixelWalk = {this, {&m_aPixelWalk[0], &m_aPixelWalk[1]}, false};
		Console()->Register("+pixelwalk", "", CFGFLAG_CLIENT, ConKeyInputState, &s_PixelWalk, "PixelWalk while held");
	}
	{
		static CInputState s_AvoidFreezeOverride = {this, {&m_aAvoidFreezeOverride[0], &m_aAvoidFreezeOverride[1]}, false};
		Console()->Register("+avoidfreeze_override", "", CFGFLAG_CLIENT, ConKeyInputState, &s_AvoidFreezeOverride, "Temporarily bypass Avoid Freeze while held");
	}

	{
		static CInputSet''',
    "PixelWalk bind command",
)

replace_once(
    "src/game/client/components/controls.cpp",
    "static CInputState s_State = {this, {&m_aInputData[0].m_Hook, &m_aInputData[1].m_Hook}, true};",
    "static CInputState s_State = {this, {&m_aManualHook[0], &m_aManualHook[1]}, true};",
    "manual hook state binding",
)
replace_once(
    "src/game/client/components/controls.cpp",
    "else\n\t{\n\t\tm_aInputData[g_Config.m_ClDummy].m_TargetX = (int)m_aMousePos[g_Config.m_ClDummy].x;\n\t\tm_aInputData[g_Config.m_ClDummy].m_TargetY = (int)m_aMousePos[g_Config.m_ClDummy].y;",
    "else\n\t{\n\t\tm_aInputData[g_Config.m_ClDummy].m_Hook = m_aManualHook[g_Config.m_ClDummy];\n\t\tm_aInputData[g_Config.m_ClDummy].m_TargetX = (int)m_aMousePos[g_Config.m_ClDummy].x;\n\t\tm_aInputData[g_Config.m_ClDummy].m_TargetY = (int)m_aMousePos[g_Config.m_ClDummy].y;",
    "manual hook state before dummy input copy",
)

# Movement assists are applied after normal and dummy input processing, before sending the packet.
replace_once(
    "src/game/client/components/controls.cpp",
    "\t\t// check if we need to send input",
    '''		// PixelWalk: throttle direction updates while its hold-bind is active.
		if(g_Config.m_ClPixelWalk && m_aPixelWalk[g_Config.m_ClDummy] && m_aInputData[g_Config.m_ClDummy].m_Direction != 0)
		{
			const int PixelWalkSpeed = std::clamp(g_Config.m_ClPixelWalkSpeed, 1, 10);
			const int PixelWalkInterval = (10 + PixelWalkSpeed - 1) / PixelWalkSpeed;
			m_PixelWalkTick = (m_PixelWalkTick + 1) % PixelWalkInterval;
			if(m_PixelWalkTick != 0)
				m_aInputData[g_Config.m_ClDummy].m_Direction = 0;
		}
		else
			m_PixelWalkTick = 0;

		// Avoid Freeze: release horizontal movement before entering a freeze tile.
		if(g_Config.m_ClAvoidFreeze && !m_aAvoidFreezeOverride[g_Config.m_ClDummy] &&
			(m_aInputData[g_Config.m_ClDummy].m_PlayerFlags & PLAYERFLAG_PLAYING) &&
			m_aInputData[g_Config.m_ClDummy].m_Direction != 0 &&
			!GameClient()->m_Snap.m_SpecInfo.m_Active)
		{
			const int LocalId = GameClient()->m_aLocalIds[g_Config.m_ClDummy];
			if(LocalId >= 0 && LocalId < MAX_CLIENTS && GameClient()->m_Snap.m_aCharacters[LocalId].m_Active)
			{
				const auto &Character = GameClient()->m_Snap.m_aCharacters[LocalId].m_Cur;
				const vec2 PlayerPos(Character.m_X, Character.m_Y);
				const int Direction = m_aInputData[g_Config.m_ClDummy].m_Direction;
				const int Range = std::clamp(g_Config.m_ClAvoidFreezeRange, 1, 4) * 20;
				if(!IsAvoidFreezeAt(*Collision(), PlayerPos) &&
					IsAvoidFreezeAhead(*Collision(), PlayerPos, Direction, Range))
				{
					m_aInputData[g_Config.m_ClDummy].m_Direction = 0;
				}
			}
		}

		// Hook Aim: when the user holds the normal hook key, adjust its direction toward the closest eligible player inside FOV.
		const int ActiveDummy = g_Config.m_ClDummy;
		m_aInputData[ActiveDummy].m_Hook = m_aManualHook[ActiveDummy];
		if(g_Config.m_ClHookAim && m_aManualHook[ActiveDummy] &&
			(m_aInputData[ActiveDummy].m_PlayerFlags & PLAYERFLAG_PLAYING) &&
			!GameClient()->m_Snap.m_SpecInfo.m_Active)
		{
			const int LocalId = GameClient()->m_aLocalIds[ActiveDummy];
			if(LocalId >= 0 && LocalId < MAX_CLIENTS && GameClient()->m_Snap.m_aCharacters[LocalId].m_Active)
			{
				const vec2 CursorPosition = CursorWorldPos();
				const float FovRadius = (float)std::clamp(g_Config.m_ClHookAimFov, 16, 256);
				int BestTarget = -1;
				float BestDistance = FovRadius;
				for(int ClientId = 0; ClientId < MAX_CLIENTS; ++ClientId)
				{
					const auto &Target = GameClient()->m_aClients[ClientId];
					if(ClientId == LocalId || !Target.m_Active || Target.m_Team == TEAM_SPECTATORS ||
						Target.m_Spec || Target.m_Paused || Target.m_HookHitDisabled ||
						!GameClient()->m_Snap.m_aCharacters[ClientId].m_Active)
						continue;
					const float DistanceToCursor = length(Target.m_RenderPos - CursorPosition);
					if(DistanceToCursor <= BestDistance)
					{
						BestDistance = DistanceToCursor;
						BestTarget = ClientId;
					}
				}
				if(BestTarget >= 0)
				{
					const vec2 HookDirection = GameClient()->m_aClients[BestTarget].m_RenderPos - GameClient()->m_LocalCharacterPos;
					if(length(HookDirection) > 0.001f)
					{
						m_aInputData[ActiveDummy].m_TargetX = round_to_int(HookDirection.x);
						m_aInputData[ActiveDummy].m_TargetY = round_to_int(HookDirection.y);
						m_aInputData[ActiveDummy].m_Hook = 1;
					}
				}
			}
		}

		// check if we need to send input''',
    "PixelWalk and Avoid Freeze steering",
)


replace_once(
    "src/game/client/components/menus.h",
    "SETTINGS_CREDITS,\n\n\t\tSETTINGS_LENGTH,",
    "SETTINGS_CREDITS,\n\t\tSETTINGS_S1NDROM,\n\n\t\tSETTINGS_LENGTH,",
    "S1ndrom settings page enum",
)
replace_once(
    "src/game/client/components/menus.h",
    "void RenderSettingsCredits(CUIRect MainView);",
    "void RenderSettingsCredits(CUIRect MainView);\n\tvoid RenderSettingsS1ndrom(CUIRect MainView);",
    "S1ndrom settings page method",
)
replace_once(
    "src/game/client/components/menus_settings.cpp",
    'Localize("Assets"),\n\t\tLocalize("Credits")};',
    'Localize("Assets"),\n\t\tLocalize("Credits"),\n\t\tLocalize("S1ndrom")};',
    "S1ndrom settings tab label",
)
replace_once(
    "src/game/client/components/menus_settings.cpp",
    '''\telse if(g_Config.m_UiSettingsPage == SETTINGS_CREDITS)
\t{
\t\tGameClient()->m_MenuBackground.ChangePosition(CMenuBackground::POS_SETTINGS_CREDITS);
\t\tRenderSettingsCredits(MainView);
\t}
\telse
''',
    '''\telse if(g_Config.m_UiSettingsPage == SETTINGS_CREDITS)
\t{
\t\tGameClient()->m_MenuBackground.ChangePosition(CMenuBackground::POS_SETTINGS_CREDITS);
\t\tRenderSettingsCredits(MainView);
\t}
\telse if(g_Config.m_UiSettingsPage == SETTINGS_S1NDROM)
\t{
\t\tGameClient()->m_MenuBackground.ChangePosition(CMenuBackground::POS_SETTINGS_GENERAL);
\t\tRenderSettingsS1ndrom(MainView);
\t}
\telse
''',
    "S1ndrom settings page navigation",
)
replace_once(
    "src/game/client/components/menus_settings.cpp",
    "bool CMenus::RenderHslaScrollbars(CUIRect *pRect, unsigned int *pColor, bool Alpha, float DarkestLight)",
    """void CMenus::RenderSettingsS1ndrom(CUIRect MainView)
{
\tCUIRect LeftColumn, RightColumn;
\tMainView.VSplitMid(&LeftColumn, &RightColumn, 20.0f);

\tauto Section = [&](CUIRect &Column, const char *pTitle) {
\t\tCUIRect Header;
\t\tColumn.HSplitTop(30.0f, &Header, &Column);
\t\tUi()->DoLabel(&Header, pTitle, 18.0f, TEXTALIGN_ML);
\t\tColumn.HSplitTop(6.0f, nullptr, &Column);
\t};
\tauto Check = [&](CUIRect &Column, int *pValue, const char *pTitle) {
\t\tCUIRect Row;
\t\tColumn.HSplitTop(24.0f, &Row, &Column);
\t\tif(DoButton_CheckBox(pValue, pTitle, *pValue, &Row))
\t\t\t*pValue ^= 1;
\t\tColumn.HSplitTop(5.0f, nullptr, &Column);
\t};
\tauto Slider = [&](CUIRect &Column, int *pValue, const char *pTitle, int Min, int Max) {
\t\tCUIRect Row;
\t\tColumn.HSplitTop(24.0f, &Row, &Column);
\t\tUi()->DoScrollbarOption(pValue, pValue, &Row, pTitle, Min, Max);
\t\tColumn.HSplitTop(7.0f, nullptr, &Column);
\t};

\tSection(LeftColumn, Localize("Hook Aim"));
\tCheck(LeftColumn, &g_Config.m_ClHookAim, Localize("Enable Hook Aim"));
\tSlider(LeftColumn, &g_Config.m_ClHookAimFov, Localize("Hook Aim FOV"), 16, 256);
\tCheck(LeftColumn, &g_Config.m_ClHookAimShowFov, Localize("Show FOV"));
\tCUIRect HookAimNote;
\tLeftColumn.HSplitTop(30.0f, &HookAimNote, &LeftColumn);
\tUi()->DoLabel(&HookAimNote, Localize("Only guides your hook while you hold the hook key."), 10.0f, TEXTALIGN_ML);

\tLeftColumn.HSplitTop(18.0f, nullptr, &LeftColumn);
\tSection(LeftColumn, Localize("Avoid Freeze"));
\tCheck(LeftColumn, &g_Config.m_ClAvoidFreeze, Localize("Enable Avoid Freeze"));
\tSlider(LeftColumn, &g_Config.m_ClAvoidFreezeRange, Localize("Stop Distance"), 1, 4);

\tSection(RightColumn, Localize("Dummy Hammer"));
\tCheck(RightColumn, &g_Config.m_ClDummyHammerOnW, Localize("Enable Dummy Hammer on W"));
\tSlider(RightColumn, &g_Config.m_ClDummyHammerWSpeed, Localize("Dummy Hammer Speed"), 1, 25);

\tRightColumn.HSplitTop(18.0f, nullptr, &RightColumn);
\tSection(RightColumn, Localize("PixelWalk"));
\tCheck(RightColumn, &g_Config.m_ClPixelWalk, Localize("Enable PixelWalk"));
\tSlider(RightColumn, &g_Config.m_ClPixelWalkSpeed, Localize("Speed"), 1, 10);

\tCUIRect Note;
\tRightColumn.HSplitTop(12.0f, nullptr, &RightColumn);
\tRightColumn.HSplitTop(36.0f, &Note, &RightColumn);
\tUi()->DoLabel(&Note, Localize("Key bindings for PixelWalk and Freeze Override are in Controls."), 10.0f, TEXTALIGN_ML);
}

bool CMenus::RenderHslaScrollbars(CUIRect *pRect, unsigned int *pColor, bool Alpha, float DarkestLight)""",
    "S1ndrom settings page UI",
)

replace_once(
    "src/game/client/components/menus_settings_controls.cpp",
    '{EBindOptionGroup::MOVEMENT, Localizable("Toggle ghost"), "toggle cl_race_show_ghost 0 1"},',
    '{EBindOptionGroup::MOVEMENT, Localizable("Toggle ghost"), "toggle cl_race_show_ghost 0 1"},\n\t\t{EBindOptionGroup::MOVEMENT, Localizable("PixelWalk"), "+pixelwalk"},\n\t\t{EBindOptionGroup::MOVEMENT, Localizable("Avoid Freeze Override"), "+avoidfreeze_override"},',
    "PixelWalk and Avoid Freeze bind options",
)

replace_once(
    "src/game/client/components/menus_settings_controls.cpp",
    '{EBindOptionGroup::MOVEMENT, Localizable("Toggle ghost"), "toggle cl_race_show_ghost 0 1"},',
    '{EBindOptionGroup::MOVEMENT, Localizable("Toggle ghost"), "toggle cl_race_show_ghost 0 1"},\n\t\t{EBindOptionGroup::MOVEMENT, Localizable("PixelWalk"), "+pixelwalk"},\n\t\t{EBindOptionGroup::MOVEMENT, Localizable("Avoid Freeze Override"), "+avoidfreeze_override"},',
    "PixelWalk and Avoid Freeze bind options",
)

# Controls menu: make PixelWalk bindable and expose the three assist settings.
replace_once(
    "src/game/client/components/menus_settings_controls.cpp",
    '''\tRenderSettingsBindsBlock(EBindOptionGroup::PRACTICE, &RightColumn, Localize("Practice"));
\tRenderSettingsBindsBlock(EBindOptionGroup::MISCELLANEOUS, &RightColumn, Localize("Miscellaneous"));''',
    '''\tRenderSettingsBindsBlock(EBindOptionGroup::PRACTICE, &RightColumn, Localize("Practice"));
\tRenderSettingsBindsBlock(EBindOptionGroup::MISCELLANEOUS, &RightColumn, Localize("Miscellaneous"));''',
    "Controls menu settings blocks",
)


# HUD overlay: list only custom features whose enable switches are on.
replace_once(
    "src/game/client/components/hud.h",
    "\tvoid RenderLocalTime(float x);",
    "\tvoid RenderLocalTime(float x);\n\tvoid RenderCustomFeatureStatus();",
    "HUD feature status declaration",
)
replace_once(
    "src/game/client/components/hud.cpp",
    "\t\tRenderLocalTime((m_Width / 7) * 3);",
    "\t\tRenderLocalTime((m_Width / 7) * 3);\n\t\tRenderCustomFeatureStatus();",
    "HUD feature status render call",
)
replace_once(
    "src/game/client/components/hud.h",
    "\tvoid RenderLocalTime(float x);\n\tvoid RenderCustomFeatureStatus();",
    "\tvoid RenderLocalTime(float x);\n\tvoid RenderCustomFeatureStatus();\n\tvoid RenderHookAimFov();",
    "HUD FOV renderer declaration",
)
replace_once(
    "src/game/client/components/hud.cpp",
    "\t\tRenderLocalTime((m_Width / 7) * 3);\n\t\tRenderCustomFeatureStatus();",
    "\t\tRenderLocalTime((m_Width / 7) * 3);",
    "Move active feature panel outside HUD toggle",
)
replace_once(
    "src/game/client/components/hud.cpp",
    "\t}\n\tRenderCursor();\n}",
    "\t}\n\tRenderCustomFeatureStatus();\n\tRenderHookAimFov();\n\tRenderCursor();\n}",
    "Draw custom overlays after world rendering",
)
replace_once(
    "src/game/client/components/hud.cpp",
    "void CHud::OnNewSnapshot()\n{",
    """void CHud::RenderHookAimFov()
{
\tif(!g_Config.m_ClHookAimShowFov ||
\t\t(Client()->State() != IClient::STATE_ONLINE && Client()->State() != IClient::STATE_DEMOPLAYBACK) ||
\t\tGameClient()->m_Menus.IsActive() || GameClient()->m_Chat.IsActive() || GameClient()->m_GameConsole.IsActive() ||
\t\t!GameClient()->m_Snap.m_pGameInfoObj)
\t\treturn;

\tconst float Zoom = std::max(GameClient()->m_Camera.m_Zoom, 0.001f);
\tconst vec2 CameraCenter = GameClient()->m_Camera.m_Center;
\tconst vec2 Cursor = GameClient()->m_Controls.m_aTargetPos[g_Config.m_ClDummy];
\tconst vec2 ScreenCenter(m_Width / 2.0f, m_Height / 2.0f);
\tconst vec2 ScreenCursor = ScreenCenter + (Cursor - CameraCenter) / Zoom;
\tconst float Radius = std::clamp((float)g_Config.m_ClHookAimFov / Zoom, 2.0f, 256.0f);

\tconstexpr int SEGMENTS = 96;
\tIGraphics::CLineItem aFovLines[SEGMENTS];
\tfor(int i = 0; i < SEGMENTS; ++i)
\t{
\t\tconst float Angle0 = 2.0f * pi * (float)i / SEGMENTS;
\t\tconst float Angle1 = 2.0f * pi * (float)(i + 1) / SEGMENTS;
\t\taFovLines[i] = IGraphics::CLineItem(
\t\t\tScreenCursor + direction(Angle0) * Radius,
\t\t\tScreenCursor + direction(Angle1) * Radius);
\t}

\tGraphics()->TextureClear();
\tGraphics()->SetColor(ColorRGBA(0.15f, 0.85f, 1.0f, 0.95f));
\tGraphics()->LinesBegin();
\tGraphics()->LinesDraw(aFovLines, SEGMENTS);
\tGraphics()->LinesEnd();
\tGraphics()->SetColor(ColorRGBA(1.0f, 1.0f, 1.0f, 1.0f));
}

void CHud::OnNewSnapshot()
{""",
    "HUD FOV circle implementation",
)

replace_once(
    "src/game/client/components/hud.cpp",
    "void CHud::OnNewSnapshot()\n{",
    '''void CHud::RenderCustomFeatureStatus()
{
\tconst char *apEnabledFeatures[5];
\tint NumFeatures = 0;
\tif(g_Config.m_ClAvoidFreeze)
\t\tapEnabledFeatures[NumFeatures++] = Localize("Avoid Freeze");
\tif(g_Config.m_ClPixelWalk)
\t\tapEnabledFeatures[NumFeatures++] = Localize("PixelWalk");
\tif(g_Config.m_ClDummyHammerOnW)
\t\tapEnabledFeatures[NumFeatures++] = Localize("Dummy Hammer (W)");
\tif(g_Config.m_ClHookAim)
\t\tapEnabledFeatures[NumFeatures++] = Localize("Hook Aim");
\tif(g_Config.m_ClAvoidFreeze && GameClient()->m_Controls.m_aAvoidFreezeOverride[g_Config.m_ClDummy])
\t\tapEnabledFeatures[NumFeatures++] = Localize("Freeze Override");

\tif(NumFeatures == 0)
\t\treturn;

\tconst float FontSize = 7.0f;
\tconst float LineHeight = 9.0f;
\tconst float Padding = 5.0f;
\tfloat TextWidth = 0.0f;
\tfor(int i = 0; i < NumFeatures; ++i)
\t\tTextWidth = std::max(TextWidth, TextRender()->TextWidth(FontSize, apEnabledFeatures[i], -1, -1.0f));

\tconst float BoxWidth = TextWidth + Padding * 2.0f;
\tconst float BoxHeight = NumFeatures * LineHeight + Padding * 2.0f;
\tconst float X = m_Width - BoxWidth - 5.0f;
\tconst float Y = 16.0f;
\tGraphics()->DrawRect(X, Y, BoxWidth, BoxHeight, ColorRGBA(0.0f, 0.0f, 0.0f, 0.45f), IGraphics::CORNER_ALL, 4.0f);

\tTextRender()->TextColor(1.0f, 1.0f, 1.0f, 1.0f);
\tfor(int i = 0; i < NumFeatures; ++i)
\t\tTextRender()->Text(X + Padding, Y + Padding + i * LineHeight, FontSize, apEnabledFeatures[i], -1.0f);
\tTextRender()->TextColor(TextRender()->DefaultTextColor());
}

void CHud::OnNewSnapshot()
{''',
    "HUD feature status implementation",
)

# Final source checks prevent silently producing a client without one of the requested features.
checks = {
    "src/engine/shared/config_variables.h": [
        "cl_pixelwalk", "cl_pixelwalk_speed", "cl_dummy_hammer_w_speed",
        "cl_avoid_freeze", "cl_avoid_freeze_range",
        "cl_hook_aim", "cl_hook_aim_fov", "cl_hook_aim_show_fov",
    ],
    "src/game/client/components/controls.cpp": [
        'Console()->Register("+pixelwalk"', 'Console()->Register("+avoidfreeze_override"', "IsAvoidFreezeAhead", "m_aAvoidFreezeOverride", "m_ClAvoidFreeze", "m_aManualHook", "m_ClHookAim",
        "CursorWorldPos()", "Target.m_RenderPos", "m_ClHookAim && m_aManualHook[ActiveDummy]",
    ],
    "src/game/client/components/menus_settings_controls.cpp": [
        'Localize("PixelWalk")', 'Localize("Dummy Hammer")', 'Localize("Avoid Freeze")',
    ],
    "src/game/client/gameclient.cpp": [
        "ClDummyHammerOnW", "ClDummyHammerWSpeed",
    ],
    "src/game/client/components/hud.cpp": [
        "RenderCustomFeatureStatus", 'Localize("Avoid Freeze")',
        'Localize("PixelWalk")', 'Localize("Dummy Hammer (W)")', 'Localize("Hook Aim")', "m_aAvoidFreezeOverride",
    ],
    "src/game/client/components/hud.h": [
        "RenderCustomFeatureStatus", "RenderHookAimFov",
    ],
    "src/game/client/components/menus.h": [
        "SETTINGS_S1NDROM", "RenderSettingsS1ndrom",
    ],
    "src/game/client/components/menus_settings.cpp": [
        'Localize("S1ndrom")', "RenderSettingsS1ndrom",
        "Only guides your hook while you hold the hook key.",
    ],
    "src/game/client/components/menus_settings_controls.cpp": [
        'Localizable("PixelWalk")', 'Localizable("Avoid Freeze Override")',
    ],
}
for relative_path, needles in checks.items():
    content = (ROOT / relative_path).read_text(encoding="utf-8")
    missing = [needle for needle in needles if needle not in content]
    if missing:
        raise SystemExit(f"Feature verification failed in {relative_path}: missing {missing}")

print("Applied and verified: W Dummy Hammer, PixelWalk, Avoid Freeze, and hold-to-hook Aim Assist.")
